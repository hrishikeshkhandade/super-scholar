import Phaser from "phaser";
import type { Paper } from "../content/types";
import { NES, css } from "../palette";
import { needsRereading, reviewAgain, unlockForRereading, type ReviewScore } from "../review";
import { GAME_WIDTH, Menu, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";
import { noLigatures, shorten } from "./listLayout";

// The end of a review: how many of each section's boss questions the player
// got right on the first try, with RE-READ beside the sections to go back to.
// RE-READ opens that section's lessons in the Notebook (whose BACK returns
// here), so the loop is: test, re-read what you missed, test again.

export interface ReviewResultsData {
  paper: Paper;
  scores: ReviewScore[];
}

const CHAR_WIDTH = 16; // the pixel font is monospace
const MAX_NAME_CHARS = 28;
const ROWS_TOP = 116;
const ROW_HEIGHT = 26;

export class ReviewResultsScene extends Phaser.Scene {
  constructor() {
    super("ReviewResults");
  }

  create({ paper, scores }: ReviewResultsData): void {
    // Opens the first of these sections' lessons; the Notebook's world arrows
    // reach the others, so all of them are unlocked.
    const reread = (worldIndexes: number[]) => {
      worldIndexes.forEach((worldIndex) => unlockForRereading(paper, worldIndex));
      this.scene.start("Notebook", {
        paperId: paper.id,
        worldIndex: worldIndexes[0],
        sectionIndex: 0,
        back: { scene: "ReviewResults", data: { paper, scores } },
      });
    };
    drawMenuBackdrop(this);
    this.add.text(GAME_WIDTH / 2, 40, "REVIEW RESULTS", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 80, shorten(paper.title, 44), textStyle(16, NES.sky)).setOrigin(0.5);

    // Three columns, centered as one block: section, score, and verdict.
    const names = scores.map((score) => noLigatures(shorten(paper.worlds[score.worldIndex].name, MAX_NAME_CHARS)));
    const counts = scores.map((score) => `${score.rightFirstTry}/${score.total}`);
    const nameWidth = Math.max(...names.map((name) => name.length));
    const countWidth = Math.max(...counts.map((count) => count.length));
    const blockWidth = (nameWidth + 2 + countWidth + 2 + "RE-READ".length) * CHAR_WIDTH;
    const left = Math.round((GAME_WIDTH - blockWidth) / 2);
    scores.forEach((score, i) => {
      const y = ROWS_TOP + i * ROW_HEIGHT;
      this.add.text(left, y, names[i], textStyle(16, NES.white));
      this.add.text(left + (nameWidth + 2) * CHAR_WIDTH, y, counts[i].padStart(countWidth), textStyle(16, NES.white));
      const verdictX = left + (nameWidth + countWidth + 4) * CHAR_WIDTH;
      if (!needsRereading(score)) {
        this.add.text(verdictX, y, "KNOWN", textStyle(16, NES.lime));
        return;
      }
      // A button: it opens this section's lessons.
      const button = this.add
        .text(verdictX, y, "RE-READ", textStyle(16, NES.salmon))
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => reread([score.worldIndex]));
      button.on("pointerover", () => button.setColor(css(NES.yellow)));
      button.on("pointerout", () => button.setColor(css(NES.salmon)));
    });

    const right = scores.reduce((sum, score) => sum + score.rightFirstTry, 0);
    const total = scores.reduce((sum, score) => sum + score.total, 0);
    const weak = scores.filter(needsRereading).map((score) => score.worldIndex);
    const summaryY = ROWS_TOP + scores.length * ROW_HEIGHT + 16;
    // Two lines on purpose: the score, then what to do about it.
    const advice =
      weak.length === 0
        ? `You know this ${scores.length === 1 ? "section" : "paper"}!`
        : `Re-read the RE-READ ${weak.length === 1 ? "section" : "sections"}, then try again.`;
    const summaryText = this.add
      .text(GAME_WIDTH / 2, summaryY, `${right}/${total} right on the first try.\n${advice}`, { ...textStyle(16, NES.yellow, GAME_WIDTH - 60), align: "center" })
      .setOrigin(0.5, 0);

    new Menu(this, 260, summaryText.y + summaryText.height + 20, [
      ...(weak.length > 0 ? [{ label: "RE-READ WEAK SECTIONS", onSelect: () => reread(weak) }] : []),
      { label: "REVIEW AGAIN", onSelect: () => this.scene.start("Boss", reviewAgain(paper, scores)) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
