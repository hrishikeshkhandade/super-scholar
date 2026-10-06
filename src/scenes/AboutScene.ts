import Phaser from "phaser";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

const ABOUT_TEXT = [
  "Paper Quest turns dense research papers into a retro runner game.",
  "Each paper is split into worlds. Run, jump the red candles, and reach the yellow flags to learn one idea at a time. Answer practice questions to earn extra lives.",
  "At the end of each world, a boss tests what you learned. Right answers hurt the boss. Wrong answers cost you a life.",
  "Made by Hrishikesh for CS 124 at the University of Illinois.",
].join("\n\n");

export class AboutScene extends Phaser.Scene {
  constructor() {
    super("About");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 40, "ABOUT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(40, 80, ABOUT_TEXT, textStyle(12, NES.white, GAME_WIDTH - 80));
    new Menu(this, 360, 400, [{ label: "BACK", onSelect: () => this.scene.start("Title") }]);
  }
}
