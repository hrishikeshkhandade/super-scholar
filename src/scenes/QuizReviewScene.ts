import Phaser from "phaser";
import { audio } from "../audio/audio";
import type { Paper, Question } from "../content/types";
import { startLives } from "../save";
import { finishedRun } from "../run";
import { NES } from "../palette";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, READING, READING_BOX, fitTextToHeight, panel, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

// After beating a boss: the questions the player got wrong, one flashcard
// per page: the question first (try to remember the answer), then a flip
// to the right answer and why. Then on to the next world or the title.

export interface QuizReviewData {
  missed: Question[];
  paper: Paper;
  nextWorld?: number; // the world to go on to, if there is one
  replay?: boolean; // from the level select, so the next world is a replay too
}

// The card sits on the reading column, with room under the menu for the hint.
const BOX = { x: READING_BOX.x, y: 60, width: READING_BOX.width, height: 254 };

export class QuizReviewScene extends Phaser.Scene {
  private params!: QuizReviewData;
  private pageIndex = 0;
  private flipped = false; // showing the answer side
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private counter!: Phaser.GameObjects.Text;

  constructor() {
    super("QuizReview");
  }

  create(data: QuizReviewData): void {
    this.params = data;
    this.pageIndex = 0;
    this.flipped = false;
    drawMenuBackdrop(this);
    this.add.text(GAME_WIDTH / 2, 30, "REVIEW YOUR MISSES", textStyle(24, NES.yellow)).setOrigin(0.5);
    panel(this, BOX.x, BOX.y, BOX.width, BOX.height)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.flip());

    const arrow = (x: number, label: string, step: number) =>
      this.add
        .text(x, BOX.y + BOX.height + 22, label, textStyle(16, NES.yellow))
        .setOrigin(0.5)
        .setPadding(10, 6, 10, 6)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.turnPage(step));
    arrow(GAME_WIDTH / 2 - 80, "<", -1);
    arrow(GAME_WIDTH / 2 + 80, ">", 1);
    this.counter = this.add.text(GAME_WIDTH / 2, BOX.y + BOX.height + 22, "", textStyle(16, NES.white)).setOrigin(0.5);

    const { paper, nextWorld, replay } = data;
    const finished = nextWorld === undefined && !replay && finishedRun(paper.id) !== undefined;
    new Menu(this, 300, BOX.y + BOX.height + 50, [
      ...(nextWorld !== undefined
        ? [
            {
              label: "NEXT WORLD",
              onSelect: () => this.scene.start("Level", { paper, worldIndex: nextWorld, checkpointsCleared: 0, lives: startLives(), replay }),
            },
          ]
        : []),
      ...(finished ? [{ label: "LEADERBOARD", onSelect: () => this.scene.start("Leaderboard", { paperId: paper.id }) }] : []),
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ], { spacing: 8, spaceChooses: false }); // Space flips the card here
    this.add
      .text(GAME_WIDTH / 2, 427, isTouchDevice() ? "TAP THE CARD TO FLIP IT   < >: PAGES" : "SPACE: FLIP   A / D: PAGE   W / S + ENTER: CHOOSE", textStyle(8, NES.lightGray))
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.turnPage(-1);
      else if (key === "d" || key === "arrowright") this.turnPage(1);
      else if (key === " ") this.flip();
    });
    this.renderPage();
  }

  private turnPage(step: number): void {
    const next = Phaser.Math.Clamp(this.pageIndex + step, 0, this.params.missed.length - 1);
    if (next === this.pageIndex) return;
    audio.playSfx("move");
    this.pageIndex = next;
    this.flipped = false; // a new card starts on its question
    this.renderPage();
  }

  private flip(): void {
    audio.playSfx("move");
    this.flipped = !this.flipped;
    this.renderPage();
  }

  private renderPage(): void {
    this.pageObjects.forEach((object) => object.destroy());
    const question = this.params.missed[this.pageIndex];
    this.counter.setText(`${this.pageIndex + 1}/${this.params.missed.length}`);
    const left = READING.x;
    const top = BOX.y + 20;
    // The hint line under the card says how to flip it.
    if (!this.flipped) {
      const prompt = this.add.text(left, top, question.prompt, textStyle(16, NES.white, READING.width));
      this.pageObjects = [prompt];
      return;
    }
    const answer = this.add.text(left, top, `Answer: ${question.choices[question.answerIndex]}`, textStyle(16, NES.lime, READING.width));
    const explanationTop = answer.y + answer.height + 20;
    const explanation = this.add.text(left, explanationTop, question.explanation, textStyle(16, NES.lightGray, READING.width));
    fitTextToHeight(explanation, BOX.y + BOX.height - 16 - explanationTop);
    this.pageObjects = [answer, explanation];
  }

}
