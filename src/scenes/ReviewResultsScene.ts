import Phaser from "phaser";
import type { Paper } from "../content/types";
import { NES } from "../palette";
import { needsRereading, reviewStage, type ReviewScore } from "../review";
import { GAME_WIDTH, Menu, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";
import { noLigatures, shorten } from "./listLayout";

// The end of a review: how many of each section's boss questions the player
// got right on the first try, with RE-READ beside the sections to go back to.

export interface ReviewResultsData {
  paper: Paper;
  scores: ReviewScore[];
}

const CHAR_WIDTH = 16; // the pixel font is monospace
const MAX_NAME_CHARS = 28;
const ROWS_TOP = 124;
const ROW_HEIGHT = 30;

export class ReviewResultsScene extends Phaser.Scene {
  constructor() {
    super("ReviewResults");
  }

  create({ paper, scores }: ReviewResultsData): void {
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
      const reread = needsRereading(score);
      this.add.text(left, y, names[i], textStyle(16, NES.white));
      this.add.text(left + (nameWidth + 2) * CHAR_WIDTH, y, counts[i].padStart(countWidth), textStyle(16, NES.white));
      this.add.text(left + (nameWidth + countWidth + 4) * CHAR_WIDTH, y, reread ? "RE-READ" : "KNOWN", textStyle(16, reread ? NES.salmon : NES.lime));
    });

    const right = scores.reduce((sum, score) => sum + score.rightFirstTry, 0);
    const total = scores.reduce((sum, score) => sum + score.total, 0);
    const toReread = scores.filter(needsRereading).length;
    const summaryY = ROWS_TOP + scores.length * ROW_HEIGHT + 16;
    const summary =
      toReread === 0
        ? `${right}/${total} right on the first try. You know this paper!`
        : `${right}/${total} right on the first try. Re-read the ${toReread === 1 ? "section" : "sections"} marked RE-READ, then try again.`;
    this.add
      .text(GAME_WIDTH / 2, summaryY, summary, { ...textStyle(16, NES.yellow, GAME_WIDTH - 120), align: "center" })
      .setOrigin(0.5, 0);

    new Menu(this, 300, summaryY + 70, [
      { label: "REVIEW AGAIN", onSelect: () => this.scene.start("Boss", reviewStage(paper, 0, [])) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
