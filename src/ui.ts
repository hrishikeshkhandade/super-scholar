import Phaser from "phaser";
import { audio } from "./audio/audio";
import type { Question } from "./content/types";
import { FONT, NES, css } from "./palette";

export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 450;
export const MAX_LIVES = 5;
export const START_LIVES = 3;

export function textStyle(
  size: number,
  color: number = NES.white,
  wrapWidth?: number,
): Phaser.Types.GameObjects.Text.TextStyle {
  return {
    fontFamily: FONT,
    fontSize: `${size}px`,
    color: css(color),
    lineSpacing: Math.round(size * 0.6),
    wordWrap: wrapWidth ? { width: wrapWidth } : undefined,
  };
}

function isTypingInInput(event: KeyboardEvent): boolean {
  return event.target instanceof HTMLInputElement;
}

export interface MenuItem {
  label: string;
  enabled?: boolean;
  onSelect: () => void;
}

// A vertical list of options. Arrow keys + Enter/Space, or hover + click/tap.
export class Menu {
  private texts: Phaser.GameObjects.Text[] = [];
  private items: MenuItem[];
  private selected = 0;
  private depth = 0;
  private readonly cursor: Phaser.GameObjects.Text;
  private readonly onKey = (event: KeyboardEvent) => this.handleKey(event);

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly x: number,
    private readonly y: number,
    items: MenuItem[],
    private readonly options: { size?: number; spacing?: number; wrapWidth?: number } = {},
  ) {
    this.items = items;
    this.cursor = scene.add.text(x - 28, y, ">", textStyle(this.size, NES.yellow));
    this.setItems(items);
    scene.input.keyboard?.on("keydown", this.onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private get size(): number {
    return this.options.size ?? 16;
  }

  setItems(items: MenuItem[]): void {
    this.texts.forEach((text) => text.destroy());
    this.items = items;
    let y = this.y;
    this.texts = items.map((item, index) => {
      const text = this.scene.add.text(this.x, y, item.label, textStyle(this.size, NES.white, this.options.wrapWidth));
      y += text.height + (this.options.spacing ?? 20);
      text.setDepth(this.depth);
      text.setInteractive({ useHandCursor: item.enabled !== false });
      text.on("pointerover", () => this.select(index));
      text.on("pointerdown", () => this.choose(index));
      return text;
    });
    const firstEnabled = items.findIndex((item) => item.enabled !== false);
    this.select(Math.max(firstEnabled, 0));
  }

  setDepth(depth: number): void {
    this.depth = depth;
    this.cursor.setDepth(depth);
    this.texts.forEach((text) => text.setDepth(depth));
  }

  setScrollFactor(factor: number): void {
    this.cursor.setScrollFactor(factor);
    this.texts.forEach((text) => text.setScrollFactor(factor));
  }

  // The y just below the last option.
  get bottom(): number {
    const last = this.texts[this.texts.length - 1];
    return last ? last.y + last.height : this.y;
  }

  // Moves every option (and the cursor) up or down.
  shiftY(dy: number): void {
    this.texts.forEach((text) => text.setY(text.y + dy));
    this.cursor.setY(this.cursor.y + dy);
  }

  setLabel(index: number, label: string): void {
    this.texts[index]?.setText(label);
  }

  private select(index: number): void {
    if (this.items[index]?.enabled === false) return;
    this.selected = index;
    this.texts.forEach((text, i) => {
      const enabled = this.items[i].enabled !== false;
      text.setColor(css(!enabled ? NES.gray : i === index ? NES.yellow : NES.white));
    });
    const target = this.texts[index];
    this.cursor.setVisible(target !== undefined);
    if (target) this.cursor.setY(target.y);
  }

  private move(step: number): void {
    const count = this.items.length;
    for (let i = 1; i <= count; i++) {
      const next = (this.selected + step * i + count * count) % count;
      if (this.items[next].enabled !== false) {
        this.select(next);
        audio.playSfx("move");
        return;
      }
    }
  }

  private choose(index: number): void {
    const item = this.items[index];
    if (!item || item.enabled === false) return;
    audio.playSfx("select");
    item.onSelect();
  }

  private handleKey(event: KeyboardEvent): void {
    if (this.items.length === 0 || event.repeat) return;
    const typing = isTypingInInput(event);
    const key = event.key.toLowerCase();
    if (key === "arrowup" || (key === "w" && !typing)) this.move(-1);
    else if (key === "arrowdown" || (key === "s" && !typing)) this.move(1);
    else if (event.key === "Enter") this.choose(this.selected);
    else if (event.key === " " && !typing) this.choose(this.selected);
    else return;
    event.preventDefault();
  }

  destroy(): void {
    this.scene.input.keyboard?.off("keydown", this.onKey);
    this.texts.forEach((text) => text.destroy());
    this.cursor.destroy();
    this.texts = [];
    this.items = [];
  }
}

// Calls onPress once for Space, Enter, or a click/tap anywhere, then stops listening.
// Listening starts on the next frame, so the click or key press that opened
// this screen doesn't immediately count as the press that closes it.
export function onceAdvance(scene: Phaser.Scene, onPress: () => void): () => void {
  let active = true;
  const keyHandler = (event: KeyboardEvent) => {
    if ((event.key === " " || event.key === "Enter") && !event.repeat) {
      event.preventDefault();
      fire();
    }
  };
  const fire = () => {
    cancel();
    onPress();
  };
  const cancel = () => {
    active = false;
    scene.input.keyboard?.off("keydown", keyHandler);
    scene.input.off("pointerdown", fire);
  };
  scene.time.delayedCall(0, () => {
    if (!active) return;
    scene.input.keyboard?.on("keydown", keyHandler);
    scene.input.on("pointerdown", fire);
  });
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, cancel);
  return cancel;
}

// Draws the player's lives as a row of hearts.
export class HeartBar {
  private hearts: Phaser.GameObjects.Image[] = [];

  constructor(scene: Phaser.Scene, x: number, y: number) {
    for (let i = 0; i < MAX_LIVES; i++) {
      this.hearts.push(scene.add.image(x + i * 34, y, "heart").setOrigin(0, 0).setDepth(10).setScrollFactor(0));
    }
  }

  set(lives: number): void {
    this.hearts.forEach((heart, i) => {
      heart.setTexture(i < lives ? "heart" : "emptyHeart");
    });
  }
}

// Cuts words off the end of a (word-wrapped) text until it fits in
// maxHeight, ending with "...", so long titles and abstracts never spill
// out of their box.
export function fitTextToHeight(text: Phaser.GameObjects.Text, maxHeight: number): void {
  if (text.height <= maxHeight) return;
  let words = text.text.split(" ");
  // Halve first for speed on very long text, then trim a word at a time.
  while (words.length > 8) {
    const half = words.slice(0, Math.ceil(words.length / 2));
    text.setText(`${half.join(" ")}...`);
    if (text.height <= maxHeight) break;
    words = half;
  }
  while (words.length > 1) {
    text.setText(`${words.join(" ")}...`);
    if (text.height <= maxHeight) return;
    words = words.slice(0, -1);
  }
}

export function panel(scene: Phaser.Scene, x: number, y: number, width: number, height: number) {
  return scene.add
    .rectangle(x, y, width, height, NES.black, 1)
    .setOrigin(0, 0)
    .setStrokeStyle(4, NES.white);
}

const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

// A multiple-choice question: the prompt on top, choices as a Menu below.
export class QuestionPanel {
  private readonly objects: Phaser.GameObjects.GameObject[] = [];
  private readonly menu: Menu;

  constructor(scene: Phaser.Scene, question: Question, top: number, onAnswer: (choiceIndex: number) => void) {
    const width = GAME_WIDTH - 40;
    this.objects.push(panel(scene, 20, top, width, GAME_HEIGHT - top - 20));
    const prompt = scene.add.text(40, top + 20, question.prompt, textStyle(16, NES.white, width - 40));
    this.objects.push(prompt);
    let answered = false;
    const items = question.choices.map((choice, index) => ({
      label: `${CHOICE_LETTERS[index]}) ${choice}`,
      onSelect: () => {
        if (answered) return;
        answered = true;
        onAnswer(index);
      },
    }));
    this.menu = new Menu(scene, 72, prompt.y + prompt.height + 20, items, {
      size: 16,
      spacing: 8,
      wrapWidth: width - 80,
    });

    // A long question grows the panel upward so every choice stays on screen.
    const overflow = this.menu.bottom + 16 - (GAME_HEIGHT - 20);
    if (overflow > 0) {
      const newTop = Math.max(top - overflow, 20);
      const shift = newTop - top;
      prompt.setY(prompt.y + shift);
      this.menu.shiftY(shift);
      (this.objects[0] as Phaser.GameObjects.Rectangle).setPosition(20, newTop).setSize(width, GAME_HEIGHT - newTop - 20);
    }
  }

  destroy(): void {
    this.menu.destroy();
    this.objects.forEach((object) => object.destroy());
  }
}
