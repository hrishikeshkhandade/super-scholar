import Phaser from "phaser";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

const ABOUT_TEXT = [
  "Super Scholar turns research papers into a retro platformer.",
  "A/D to move, W to jump. Stomp bears for fun facts. Each flag unlocks a lesson, and each world ends with a quiz boss.",
].join("\n\n");

const LINKEDIN_URL = "https://www.linkedin.com/in/hrishikeshkhandade";
const GITHUB_URL = "https://github.com/hrishikeshkhandade";

// Links open in a new tab, so the game keeps its place.
function openLink(url: string): void {
  window.open(url, "_blank", "noopener");
}

export class AboutScene extends Phaser.Scene {
  constructor() {
    super("About");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 36, "ABOUT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(40, 70, ABOUT_TEXT, textStyle(16, NES.white, GAME_WIDTH - 80));

    this.add.text(GAME_WIDTH / 2, 262, "MADE BY", textStyle(8, NES.lightGray)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 286, "HRISHIKESH KHANDADE", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 312, "for CS 124 at the University of Illinois", textStyle(8, NES.lightGray)).setOrigin(0.5);

    // The profile links are menu options with pixel icons, not raw URLs.
    const menuX = 330;
    const menuY = 338;
    const menu = new Menu(this, menuX, menuY, [
      { label: "LINKEDIN", onSelect: () => openLink(LINKEDIN_URL) },
      { label: "GITHUB", onSelect: () => openLink(GITHUB_URL) },
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
    const rowHeight = (menu.bottom - menuY + 20) / 3;
    const icon = (y: number, key: string, url: string) =>
      this.add
        .image(menuX - 56, y, key)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => openLink(url));
    icon(menuY + 8, "linkedin", LINKEDIN_URL);
    icon(menuY + rowHeight + 8, "github", GITHUB_URL);
    this.add
      .text(GAME_WIDTH / 2, 438, "Built with Phaser and pdf.js. Paper search: OpenAlex. Font: Press Start 2P.", textStyle(8, NES.lightGray))
      .setOrigin(0.5);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));
  }
}
