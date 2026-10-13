import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper } from "../content/library";
import { NES } from "../palette";
import { loadProgress } from "../save";
import { GAME_WIDTH, Menu, START_LIVES, textStyle, type MenuItem } from "../ui";
import { LAST_QUERY_KEY } from "./PaperSelectScene";

const CHAR_WIDTH = 16; // the pixel font is monospace
const ROW_HEIGHT = 36; // a 16px option plus 20px spacing
const MENU_AREA = { top: 136, bottom: 412 }; // between the subtitle and the hint
const SPRITE_GAP = 130;

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    audio.playMusic("title");
    this.add.text(GAME_WIDTH / 2, 70, "SUPER SCHOLAR", textStyle(40, NES.yellow)).setOrigin(0.5);
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
      { label: "NOTEBOOK", onSelect: () => this.scene.start("Notebook") },
      { label: "SETTINGS", onSelect: () => this.scene.start("Settings") },
      { label: "ABOUT", onSelect: () => this.scene.start("About") },
      { label: "CREDITS", onSelect: () => this.scene.start("Credits", { from: "Title" }) },
    ];

    // Every option is centered on its own line, NES style, between the
    // subtitle and the hint. The bear and the player stand the same distance
    // out on each side, level with the middle of the menu.
    const menuWidth = Math.max(...items.map((item) => item.label.length)) * CHAR_WIDTH;
    const menuTop = Math.round((MENU_AREA.top + MENU_AREA.bottom - (items.length * ROW_HEIGHT - 20)) / 2);
    const menu = new Menu(this, GAME_WIDTH / 2, menuTop, items, { align: "center" });
    const middle = (menuTop + menu.bottom) / 2;
    this.add.sprite(GAME_WIDTH / 2 - menuWidth / 2 - SPRITE_GAP, middle, "bear-walk1").setScale(2).play("bear-walk");
    this.add.image(GAME_WIDTH / 2 + menuWidth / 2 + SPRITE_GAP, middle, "player-idle").setScale(2);

    this.add
      .text(GAME_WIDTH / 2, 420, "W / S TO CHOOSE, ENTER TO SELECT, OR CLICK", textStyle(8, NES.lightGray))
      .setOrigin(0.5);
  }
}
