import Phaser from "phaser";
import type { OnlinePaper } from "../content/openAlex";
import { NES } from "../palette";
import { GAME_WIDTH, Menu, panel, textStyle } from "../ui";

const ABSTRACT_CHARS = 200;

// Details for a paper found online. AI game generation will start from here.
export class PaperDetailScene extends Phaser.Scene {
  constructor() {
    super("PaperDetail");
  }

  create(data: { paper: OnlinePaper }): void {
    const { paper } = data;
    this.cameras.main.setBackgroundColor(NES.navy);

    const title = this.add.text(40, 30, paper.title, textStyle(16, NES.yellow, GAME_WIDTH - 80));
    const authors = paper.authors.length > 4 ? `${paper.authors.slice(0, 4).join(", ")} et al.` : paper.authors.join(", ");
    const meta = [authors, paper.year, paper.field].filter(Boolean).join("  |  ");
    const metaText = this.add.text(40, title.y + title.height + 12, meta, textStyle(8, NES.sky, GAME_WIDTH - 80));

    const availability = paper.pdfUrl ? "FULL TEXT AVAILABLE" : "ABSTRACT ONLY";
    const tag = this.add.text(40, metaText.y + metaText.height + 12, availability, textStyle(8, paper.pdfUrl ? NES.lime : NES.tan));

    const abstract =
      paper.abstract.length > ABSTRACT_CHARS ? `${paper.abstract.slice(0, ABSTRACT_CHARS).trimEnd()}...` : paper.abstract;
    const boxTop = tag.y + tag.height + 12;
    panel(this, 30, boxTop, GAME_WIDTH - 60, 330 - boxTop);
    this.add.text(46, boxTop + 14, abstract || "No abstract available.", textStyle(16, NES.white, GAME_WIDTH - 92));

    this.add
      .text(GAME_WIDTH / 2, 350, "AI game generation is coming soon!", textStyle(16, NES.salmon))
      .setOrigin(0.5, 0);
    new Menu(this, 280, 390, [{ label: "BACK TO SEARCH", onSelect: () => this.scene.start("PaperSelect") }]);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("PaperSelect"));
  }
}
