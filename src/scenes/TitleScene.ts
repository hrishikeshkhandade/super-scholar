import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper } from "../content/library";
import { TILE } from "../levels/parseLevel";
import { farKey, groundKey, groundTopKey, hillsKey } from "../levels/themeTextures";
import { THEMES } from "../levels/themes";
import { NES, css } from "../palette";
import { loadProgress } from "../save";
import { GAME_HEIGHT, GAME_WIDTH, Menu, START_LIVES, panel, textStyle, type MenuItem } from "../ui";
import { LAST_QUERY_KEY } from "./PaperSelectScene";

// The title screen, styled like a classic NES title: a level scene behind a
// big outlined logo, a framed box with the four main choices, and the less
// used ones (settings, about, credits, feedback) in a row along the bottom.

const SCENE_THEME = THEMES.find((theme) => theme.name === "forest") ?? THEMES[0];
const GROUND_TOP = GAME_HEIGHT - 2 * TILE; // two rows of ground tiles
const BOX = { width: 304, top: 156, padding: 22 };
const POST = { width: 14, inset: 48 }; // the sign's two wooden posts
const MENU_SPACING = 14;
const ROW_Y = GAME_HEIGHT - 26; // the row of extra-option buttons, on the ground
const ROW_GAP = 12;
const BUTTON_PADDING = { x: 10, y: 6 };

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    audio.playMusic("title");
    this.drawScene();
    this.drawLogo();

    const progress = loadProgress();
    const savedPaper = progress && findPaper(progress.paperId);
    const canContinue = savedPaper !== undefined && progress!.worldIndex < savedPaper.worlds.length;
    const mainItems: MenuItem[] = [
      {
        label: "NEW GAME",
        onSelect: () => {
          this.registry.set(LAST_QUERY_KEY, "");
          this.scene.start("PaperSelect");
        },
      },
      {
        label: "CONTINUE",
        enabled: canContinue,
        onSelect: () => {
          const atBoss = progress!.checkpointsCleared >= savedPaper!.worlds[progress!.worldIndex].cutscenes.length;
          this.scene.start(atBoss ? "Boss" : "Level", {
            paper: savedPaper,
            worldIndex: progress!.worldIndex,
            checkpointsCleared: progress!.checkpointsCleared,
            lives: START_LIVES,
          });
        },
      },
      { label: "LEVEL SELECT", onSelect: () => this.scene.start("LevelSelect") },
      { label: "NOTEBOOK", onSelect: () => this.scene.start("Notebook") },
    ];
    const extraItems: MenuItem[] = [
      { label: "SETTINGS", onSelect: () => this.scene.start("Settings") },
      { label: "ABOUT", onSelect: () => this.scene.start("About") },
      { label: "CREDITS", onSelect: () => this.scene.start("Credits", { from: "Title" }) },
      { label: "FEEDBACK", onSelect: () => this.scene.start("Feedback") },
    ];

    // The menu is a signboard on two wooden posts planted in the ground, so
    // it stands in front of the mountains instead of floating across them.
    const rowsHeight = mainItems.length * (16 + MENU_SPACING) - MENU_SPACING;
    const boxHeight = rowsHeight + BOX.padding * 2;
    const boxLeft = (GAME_WIDTH - BOX.width) / 2;
    for (const postX of [boxLeft + POST.inset, boxLeft + BOX.width - POST.inset - POST.width]) {
      this.add
        .rectangle(postX, BOX.top + boxHeight, POST.width, GROUND_TOP - (BOX.top + boxHeight) + 6, NES.brown)
        .setOrigin(0, 0)
        .setStrokeStyle(2, NES.black);
    }
    panel(this, boxLeft, BOX.top, BOX.width, boxHeight);
    const row = new ExtraRow(this, extraItems);
    const menu = new Menu(this, GAME_WIDTH / 2, BOX.top + BOX.padding, mainItems, {
      align: "center",
      spacing: MENU_SPACING,
      // Down past the last choice moves to the bottom row; up from the row comes back.
      onEdge: (direction) => {
        if (direction !== 1) return;
        menu.setActive(false);
        row.focus(0);
      },
    });
    row.onLeave = () => {
      row.blur();
      audio.playSfx("move");
      // Next frame, so the same W press doesn't also move the box's cursor.
      this.time.delayedCall(0, () => menu.setActive(true));
    };
  }

  // A forest level: sky bands, drifting clouds, mountains, hills, and two
  // rows of ground with a few blocks, the bear, and the scholar on it.
  private drawScene(): void {
    const theme = SCENE_THEME;
    this.cameras.main.setBackgroundColor(theme.sky[2]);
    const band = 90;
    theme.sky.slice(0, 2).forEach((color, i) => this.add.rectangle(0, i * band, GAME_WIDTH, band, color).setOrigin(0, 0));
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(80 + i * 220, 40 + (i % 2) * 34, "cloud").setAlpha(theme.cloudAlpha);
      this.tweens.add({ targets: cloud, x: cloud.x + 40, duration: 7000 + i * 900, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    this.add.tileSprite(0, GROUND_TOP - 200, GAME_WIDTH, 200, farKey(theme)).setOrigin(0, 0).setAlpha(0.9);
    this.add.tileSprite(0, GROUND_TOP - 120, GAME_WIDTH, 128, hillsKey(theme)).setOrigin(0, 0);
    for (let x = 0; x < GAME_WIDTH; x += TILE) {
      this.add.image(x + TILE / 2, GROUND_TOP + TILE / 2, groundTopKey(theme));
      this.add.image(x + TILE / 2, GROUND_TOP + TILE * 1.5, groundKey(theme));
    }
    // Blocks floating above the ground on the right, like the first screen of a level.
    const blockY = GROUND_TOP - TILE * 2.5;
    ["brick", "question-block", "brick"].forEach((key, i) => this.add.image(620 + i * TILE, blockY, key));

    // The bear paces on the ground; the scholar hops beside the blocks.
    const footY = GROUND_TOP - 20;
    const bear = this.add.sprite(70, footY, "bear-walk1").setScale(1.5).play("bear-walk").setFlipX(true);
    this.tweens.add({
      targets: bear,
      x: 230,
      duration: 3600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onYoyo: () => bear.setFlipX(false),
      onRepeat: () => bear.setFlipX(true),
    });
    const scholar = this.add.image(560, footY, "player-idle").setScale(1.5);
    this.tweens.add({ targets: scholar, y: footY - 22, duration: 240, yoyo: true, repeat: -1, repeatDelay: 2000, ease: "Quad.easeOut" });
  }

  // Big yellow letters with a thick black outline and a drop shadow.
  private drawLogo(): void {
    const outlined = (text: Phaser.GameObjects.Text, thickness: number) =>
      text.setStroke(css(NES.black), thickness).setShadow(4, 4, css(NES.black), 0, true, true);
    const logo = outlined(this.add.text(GAME_WIDTH / 2, 70, "SUPER SCHOLAR", textStyle(48, NES.yellow)).setOrigin(0.5), 10);
    this.tweens.add({ targets: logo, y: 64, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    outlined(this.add.text(GAME_WIDTH / 2, 120, "Research papers, but make it a game", textStyle(16, NES.white)).setOrigin(0.5), 6);
  }
}

// The row of less used options along the bottom: A/D (or arrows) move along
// it, W (or up) goes back to the main box, Enter or Space chooses. Tapping or
// clicking works any time.
class ExtraRow {
  onLeave: () => void = () => {};
  private readonly texts: Phaser.GameObjects.Text[] = [];
  private readonly frames: Phaser.GameObjects.Rectangle[] = [];
  private focused = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
  ) {
    // Each option is a small framed button, so they read as clickable.
    const labels = items.map((item) =>
      scene.add
        .text(0, ROW_Y, item.label, textStyle(16, NES.white))
        .setOrigin(0, 0.5)
        .setPadding(BUTTON_PADDING.x, BUTTON_PADDING.y, BUTTON_PADDING.x, BUTTON_PADDING.y)
        .setDepth(1)
        .setInteractive({ useHandCursor: true }),
    );
    const width = labels.reduce((sum, label) => sum + label.width, 0) + ROW_GAP * (labels.length - 1);
    let x = (GAME_WIDTH - width) / 2;
    labels.forEach((label, i) => {
      label.setX(x);
      this.frames.push(
        scene.add.rectangle(x, ROW_Y, label.width, label.height, NES.black).setOrigin(0, 0.5).setStrokeStyle(2, NES.white),
      );
      x += label.width + ROW_GAP;
      label.on("pointerover", () => this.highlight(i));
      label.on("pointerout", () => this.highlight(this.focused));
      label.on("pointerdown", () => this.choose(i));
      this.texts.push(label);
    });

    const onKey = (event: KeyboardEvent) => {
      if (this.focused < 0 || event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.focus(Math.max(this.focused - 1, 0), true);
      else if (key === "d" || key === "arrowright") this.focus(Math.min(this.focused + 1, this.texts.length - 1), true);
      else if (key === "w" || key === "arrowup") this.onLeave();
      else if (key === "enter" || key === " ") this.choose(this.focused);
      else return;
      event.preventDefault();
    };
    scene.input.keyboard?.on("keydown", onKey);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => scene.input.keyboard?.off("keydown", onKey));
  }

  focus(index: number, withSound = false): void {
    if (withSound && index !== this.focused) audio.playSfx("move");
    this.focused = index;
    this.highlight(index);
  }

  blur(): void {
    this.focused = -1;
    this.highlight(-1);
  }

  private highlight(index: number): void {
    this.texts.forEach((text, i) => {
      const color = i === index ? NES.yellow : NES.white;
      text.setColor(css(color));
      this.frames[i].setStrokeStyle(2, color);
    });
  }

  private choose(index: number): void {
    audio.playSfx("select");
    this.items[index].onSelect();
  }
}
