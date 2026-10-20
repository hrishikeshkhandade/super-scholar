import Phaser from "phaser";
import type { OnlinePaper } from "../content/openAlex";
import { NES } from "../palette";
import type { PaperSource } from "./GenerateScene";
import { GAME_WIDTH, Menu, fitTextToHeight, panel, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

const TITLE_MAX_HEIGHT = 44; // two lines of 16px text
const BOX_BOTTOM = 326;

// Details for a paper found online, with a way to open it and get its PDF.
export class PaperDetailScene extends Phaser.Scene {
  constructor() {
    super("PaperDetail");
  }

  create(data: { paper: OnlinePaper }): void {
    const { paper } = data;
    drawMenuBackdrop(this);

    const title = this.add.text(40, 30, paper.title, textStyle(16, NES.yellow, GAME_WIDTH - 80));
    fitTextToHeight(title, TITLE_MAX_HEIGHT);
    const authors = paper.authors.length > 4 ? `${paper.authors.slice(0, 4).join(", ")} et al.` : paper.authors.join(", ");
    const meta = [authors, paper.year, paper.field].filter(Boolean).join("  |  ");
    const metaText = this.add.text(40, title.y + title.height + 12, meta, textStyle(8, NES.sky, GAME_WIDTH - 80));

    const availability = paper.pdfUrl ? "FREE PDF AVAILABLE" : "ABSTRACT ONLY (PAYWALLED)";
    const tag = this.add.text(40, metaText.y + metaText.height + 12, availability, textStyle(8, paper.pdfUrl ? NES.lime : NES.tan));

    const boxTop = tag.y + tag.height + 12;
    panel(this, 30, boxTop, GAME_WIDTH - 60, BOX_BOTTOM - boxTop);
    const abstract = this.add.text(46, boxTop + 14, paper.abstract || "No abstract available.", textStyle(16, NES.white, GAME_WIDTH - 92));
    fitTextToHeight(abstract, BOX_BOTTOM - boxTop - 24);

    const hint = paper.pdfUrl
      ? "PLAY downloads the free PDF and builds your game right here."
      : "Paywalled: open it (your library may have access), save the PDF, then upload it.";
    this.add.text(GAME_WIDTH / 2, 338, hint, textStyle(8, NES.salmon, GAME_WIDTH - 80)).setOrigin(0.5, 0).setAlign("center");
    const source: PaperSource = {
      download: { id: paper.id, title: paper.title, authors: paper.authors, year: paper.year },
    };
    new Menu(
      this,
      260,
      paper.pdfUrl ? 358 : 370,
      [
        ...(paper.pdfUrl ? [{ label: "PLAY THIS PAPER", onSelect: () => this.scene.start("Generate", source) }] : []),
        // Opens in a new tab, so the game keeps its place.
        { label: "OPEN PAPER", onSelect: () => window.open(paper.pdfUrl ?? `https://openalex.org/${paper.id}`, "_blank", "noopener") },
        { label: "BACK TO SEARCH", onSelect: () => this.scene.start("PaperSelect") },
      ],
      { spacing: 8 },
    );
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("PaperSelect"));
  }
}
