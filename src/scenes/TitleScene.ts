import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper } from "../content/library";
import { TILE } from "../levels/parseLevel";
import { NES, css } from "../palette";
import { loadProgress } from "../save";
import { GAME_HEIGHT, GAME_WIDTH, Menu, PointerGuard, START_LIVES, panel, textStyle, type MenuItem } from "../ui";
import { GROUND_TOP, drawBackdrop } from "./backdrop";
import { LAST_QUERY_KEY } from "./PaperSelectScene";

// The title screen, styled like a classic NES title: a level scene behind a
// big outlined logo, a framed box with the four main choices, and the less
// used ones (settings, about, credits, feedback) in a row along the bottom.

// The sign's top sits below where the sky's teal band ends (y=180), so it
// stands in front of the mountains without cutting across the sky.
const BOX = { width: 304, top: 196, padding: 18 };
const POST = { width: 14, inset: 48 }; // the sign's two wooden posts
const MENU_SPACING = 14;
const STRIP_HEIGHT = 30; // the slim dark bar along the bottom
const ROW_Y = GAME_HEIGHT - STRIP_HEIGHT / 2;
const ROW_GAP = 28; // between options, with a small dot in the middle
const TAP_PADDING = { x: 10, y: 7 }; // invisible, for an easier tap target

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

  // The shared forest backdrop, plus a few blocks, the bear, and the scholar.
  private drawScene(): void {
    drawBackdrop(this);
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
  private readonly underline: Phaser.GameObjects.Rectangle;
  private focused = -1;

  constructor(
    scene: Phaser.Scene,
    private readonly items: MenuItem[],
  ) {
    const pointer = new PointerGuard(scene);
    // A slim dark bar, like a status bar, so the options stand out from the
    // ground without heavy boxes. The chosen one turns yellow and underlined.
    scene.add.rectangle(0, GAME_HEIGHT - STRIP_HEIGHT, GAME_WIDTH, STRIP_HEIGHT, NES.black, 0.7).setOrigin(0, 0);
    const labels = items.map((item) =>
      scene.add
        .text(0, ROW_Y, item.label, textStyle(16, NES.white))
        .setOrigin(0, 0.5)
        .setPadding(TAP_PADDING.x, TAP_PADDING.y, TAP_PADDING.x, TAP_PADDING.y)
        .setInteractive({ useHandCursor: true }),
    );
    const width = labels.reduce((sum, label) => sum + label.width, 0) + ROW_GAP * (labels.length - 1);
    let x = (GAME_WIDTH - width) / 2;
    labels.forEach((label, i) => {
      label.setX(x);
      if (i > 0) scene.add.rectangle(x - ROW_GAP / 2, ROW_Y, 4, 4, NES.gray);
      x += label.width + ROW_GAP;
      label.on("pointerover", () => pointer.canHover && this.highlight(i));
      label.on("pointerout", () => this.highlight(this.focused));
      label.on("pointerdown", () => pointer.canClick && this.choose(i));
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
    this.underline = scene.add.rectangle(0, ROW_Y + 11, 10, 2, NES.yellow).setOrigin(0, 0.5).setVisible(false);
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
    this.texts.forEach((text, i) => text.setColor(css(i === index ? NES.yellow : NES.white)));
    const chosen = this.texts[index];
    this.underline.setVisible(chosen !== undefined);
    if (chosen) this.underline.setPosition(chosen.x + TAP_PADDING.x, ROW_Y + 11).setSize(chosen.width - TAP_PADDING.x * 2, 2);
  }

  private choose(index: number): void {
    audio.playSfx("select");
    this.items[index].onSelect();
  }
}
