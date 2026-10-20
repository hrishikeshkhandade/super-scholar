import Phaser from "phaser";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

const ABOUT_TEXT = "Super Scholar turns research papers into a retro platformer you learn from.";

// Key on the left, what it does on the right.
const CONTROLS: [string, string][] = [
  ["A / D", "MOVE"],
  ["W / SPACE", "JUMP"],
  ["S", "DROP THROUGH PLATFORMS"],
  ["ESC / P", "PAUSE"],
  ["A / D IN LESSONS", "BACK / NEXT PAGE"],
];

const GOAL_TEXT =
  "Stomp bears for fun facts and hit ? blocks for power-ups. Each flag unlocks a lesson; beat the quiz boss to clear the world.";

const LINKEDIN_URL = "https://www.linkedin.com/in/hrishikeshkhandade";
const GITHUB_URL = "https://github.com/hrishikeshkhandade";

// Links open in a new tab, so the game keeps its place.
function openLink(url: string): void {
  window.open(url, "_blank", "noopener");
}

// What the game is and how to play it.
export class AboutScene extends Phaser.Scene {
  constructor() {
    super("About");
  }

  create(): void {
    drawMenuBackdrop(this);
    this.add.text(GAME_WIDTH / 2, 32, "ABOUT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(40, 60, ABOUT_TEXT, textStyle(16, NES.white, GAME_WIDTH - 80));

    this.add.text(40, 120, "HOW TO PLAY", textStyle(16, NES.yellow));
    CONTROLS.forEach(([key, action], i) => {
      const y = 150 + i * 26;
      this.add.text(60, y, key, textStyle(16, NES.sky));
      this.add.text(360, y, action, textStyle(16, NES.white));
    });
    this.add.text(40, 290, GOAL_TEXT, textStyle(16, NES.white, GAME_WIDTH - 80));

    new Menu(this, 330, 370, [
      { label: "CREDITS", onSelect: () => this.scene.start("Credits", { from: "About" }) },
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));
  }
}

// Who made the game, with links to the author's profiles.
export class CreditsScene extends Phaser.Scene {
  constructor() {
    super("Credits");
  }

  // BACK returns to whichever screen opened the credits (title or About).
  create(data: { from?: string }): void {
    const back = () => this.scene.start(data.from ?? "About");
    drawMenuBackdrop(this);
    const centered = (y: number, text: string, size: number, color: number) =>
      this.add.text(GAME_WIDTH / 2, y, text, textStyle(size, color)).setOrigin(0.5);
    centered(40, "CREDITS", 24, NES.yellow);
    centered(122, "MADE BY", 16, NES.lightGray);
    centered(160, "HRISHIKESH KHANDADE", 24, NES.yellow);
    centered(192, "for CS 124 at the University of Illinois", 16, NES.lightGray);

    // The profile links are menu options with pixel icons, not raw URLs.
    const menuX = 330;
    // Low enough that BACK lands on empty grass on the title screen, not on
    // one of its options (the mouse is still there when the title opens).
    const menuY = 286;
    const menu = new Menu(this, menuX, menuY, [
      { label: "LINKEDIN", onSelect: () => openLink(LINKEDIN_URL) },
      { label: "GITHUB", onSelect: () => openLink(GITHUB_URL) },
      { label: "BACK", onSelect: back },
    ]);
    const rowHeight = (menu.bottom - menuY + 20) / 3;
    const icon = (y: number, key: string, url: string) =>
      this.add
        .image(menuX - 56, y, key)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => openLink(url));
    icon(menuY + 8, "linkedin", LINKEDIN_URL);
    icon(menuY + rowHeight + 8, "github", GITHUB_URL);

    centered(408, "Made with Phaser, pdf.js & OpenAlex", 16, NES.sky);
    this.input.keyboard?.on("keydown-ESC", back);
  }
}
