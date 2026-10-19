import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper } from "../content/library";
import { NES } from "../palette";
import { loadProgress } from "../save";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, START_LIVES, textStyle, type MenuItem } from "../ui";
import { LAST_QUERY_KEY } from "./PaperSelectScene";

const CHAR_WIDTH = 16; // the pixel font is monospace
const MENU_SPACING = 14;
const ROW_HEIGHT = 16 + MENU_SPACING; // a 16px option plus its spacing
const MENU_AREA = { top: 136, bottom: 412 }; // between the subtitle and the hint
const SPRITE_GAP = 130;
const BEAR_PACE = 60; // how far the bear walks back and forth
const STAR_COUNT = 28;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    audio.playMusic("title");
    this.addTwinklingStars();
    const logo = this.add.text(GAME_WIDTH / 2, 70, "SUPER SCHOLAR", textStyle(40, NES.yellow)).setOrigin(0.5);
    this.tweens.add({ targets: logo, y: 64, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add
      .text(GAME_WIDTH / 2, 125, "Research papers, but make it a game", textStyle(16, NES.sky))
      .setOrigin(0.5);

    const progress = loadProgress();
    const savedPaper = progress && findPaper(progress.paperId);
    const canContinue = savedPaper !== undefined && progress!.worldIndex < savedPaper.worlds.length;

    const items: MenuItem[] = [
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
      { label: "FEEDBACK", onSelect: () => this.scene.start("Feedback") },
      { label: "SETTINGS", onSelect: () => this.scene.start("Settings") },
      { label: "ABOUT", onSelect: () => this.scene.start("About") },
      { label: "CREDITS", onSelect: () => this.scene.start("Credits", { from: "Title" }) },
    ];

    // Every option is centered on its own line, NES style, between the
    // subtitle and the hint. The bear and the player stand the same distance
    // out on each side, level with the middle of the menu.
    const menuWidth = Math.max(...items.map((item) => item.label.length)) * CHAR_WIDTH;
    const menuTop = Math.round((MENU_AREA.top + MENU_AREA.bottom - (items.length * ROW_HEIGHT - MENU_SPACING)) / 2);
    const menu = new Menu(this, GAME_WIDTH / 2, menuTop, items, { align: "center", spacing: MENU_SPACING });
    const middle = (menuTop + menu.bottom) / 2;
    // The bear paces back and forth; the scholar hops now and then.
    const bearX = GAME_WIDTH / 2 - menuWidth / 2 - SPRITE_GAP;
    const bear = this.add.sprite(bearX - BEAR_PACE / 2, middle, "bear-walk1").setScale(2).play("bear-walk");
    this.tweens.add({
      targets: bear,
      x: bearX + BEAR_PACE / 2,
      duration: 2400,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      onYoyo: () => bear.setFlipX(false),
      onRepeat: () => bear.setFlipX(true),
    });
    bear.setFlipX(true);
    const scholar = this.add.image(GAME_WIDTH / 2 + menuWidth / 2 + SPRITE_GAP, middle, "player-idle").setScale(2);
    this.tweens.add({ targets: scholar, y: middle - 16, duration: 220, yoyo: true, repeat: -1, repeatDelay: 2200, ease: "Quad.easeOut" });

    this.add
      .text(GAME_WIDTH / 2, 420, isTouchDevice() ? "TAP AN OPTION TO CHOOSE IT" : "W / S TO CHOOSE, ENTER TO SELECT, OR CLICK", textStyle(8, NES.lightGray))
      .setOrigin(0.5);
  }

  // Small stars that fade in and out at random, kept out of the menu's middle
  // column so they never sit behind the text.
  private addTwinklingStars(): void {
    for (let i = 0; i < STAR_COUNT; i++) {
      const leftSide = i % 2 === 0;
      const x = leftSide ? Phaser.Math.Between(16, 230) : Phaser.Math.Between(570, 784);
      const y = Phaser.Math.Between(16, 434);
      const size = Phaser.Math.RND.pick([2, 4]);
      const star = this.add.rectangle(x, y, size, size, Phaser.Math.RND.pick([NES.white, NES.yellow, NES.sky])).setAlpha(0.2);
      this.tweens.add({
        targets: star,
        alpha: 0.9,
        duration: Phaser.Math.Between(600, 1400),
        delay: Phaser.Math.Between(0, 3000),
        yoyo: true,
        repeat: -1,
      });
    }
  }
}
