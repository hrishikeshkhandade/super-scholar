import Phaser from "phaser";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";

const ABOUT_TEXT =
  "Super Scholar turns research papers into a retro platformer: stomp bears for fun facts, reach flags for lessons, and beat a quiz boss.";

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
    this.add.text(GAME_WIDTH / 2, 32, "ABOUT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(40, 60, ABOUT_TEXT, textStyle(16, NES.white, GAME_WIDTH - 80));

    const centered = (y: number, text: string, size: number, color: number) =>
      this.add.text(GAME_WIDTH / 2, y, text, textStyle(size, color)).setOrigin(0.5);
    centered(166, "MADE BY", 16, NES.lightGray);
    centered(204, "HRISHIKESH KHANDADE", 24, NES.yellow);
    centered(236, "for CS 124 at the University of Illinois", 16, NES.lightGray);

    // The profile links are menu options with pixel icons, not raw URLs.
    const menuX = 330;
    const menuY = 262;
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

    centered(392, "Built with Phaser and pdf.js", 16, NES.sky);
    centered(418, "Search: OpenAlex   Font: Press Start 2P", 16, NES.sky);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));
  }
}
