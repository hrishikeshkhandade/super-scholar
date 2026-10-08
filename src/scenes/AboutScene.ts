import Phaser from "phaser";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

const ABOUT_TEXT = [
  "Super Scholar turns research papers into a retro platformer.",
  "A/D to move, W to jump. Stomp bears for fun facts. Each flag unlocks a lesson, and each world ends with a quiz boss.",
  "Made by Hrishikesh for CS 124 at the University of Illinois.",
].join("\n\n");

export class AboutScene extends Phaser.Scene {
  constructor() {
    super("About");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 40, "ABOUT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(40, 80, ABOUT_TEXT, textStyle(16, NES.white, GAME_WIDTH - 80));
    new Menu(this, 360, 400, [{ label: "BACK", onSelect: () => this.scene.start("Title") }]);
  }
}
