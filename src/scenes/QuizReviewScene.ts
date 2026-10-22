import Phaser from "phaser";
import { audio } from "../audio/audio";
import type { Paper, Question } from "../content/types";
import { startLives } from "../save";
import { NES } from "../palette";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, fitTextToHeight, panel, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

// After beating a boss: the questions the player got wrong, each with the
// right answer and why, one per page. Then on to the next world or the title.

export interface QuizReviewData {
  missed: Question[];
  paper: Paper;
  nextWorld?: number; // the world to go on to, if there is one
}

// Leaves room under the menu for the controls hint.
const BOX = { x: 20, y: 60, width: GAME_WIDTH - 40, height: 254 };
const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

export class QuizReviewScene extends Phaser.Scene {
  private params!: QuizReviewData;
  private pageIndex = 0;
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private counter!: Phaser.GameObjects.Text;

  constructor() {
    super("QuizReview");
  }

  create(data: QuizReviewData): void {
    this.params = data;
    this.pageIndex = 0;
    drawMenuBackdrop(this);
    this.add.text(GAME_WIDTH / 2, 30, "REVIEW YOUR MISSES", textStyle(24, NES.yellow)).setOrigin(0.5);
    panel(this, BOX.x, BOX.y, BOX.width, BOX.height);

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

    const { paper, nextWorld } = data;
    new Menu(this, 300, BOX.y + BOX.height + 50, [
      ...(nextWorld !== undefined
        ? [
            {
              label: "NEXT WORLD",
              onSelect: () => this.scene.start("Level", { paper, worldIndex: nextWorld, checkpointsCleared: 0, lives: startLives() }),
            },
          ]
        : []),
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ], { spacing: 8 });
    this.add
      .text(GAME_WIDTH / 2, 427, isTouchDevice() ? "TAP < > TO TURN PAGES" : "A / D: PAGE   W / S + ENTER: CHOOSE", textStyle(8, NES.lightGray))
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.turnPage(-1);
      else if (key === "d" || key === "arrowright") this.turnPage(1);
    });
    this.renderPage();
  }

  private turnPage(step: number): void {
    const next = Phaser.Math.Clamp(this.pageIndex + step, 0, this.params.missed.length - 1);
    if (next === this.pageIndex) return;
    audio.playSfx("move");
    this.pageIndex = next;
    this.renderPage();
  }

  private renderPage(): void {
    this.pageObjects.forEach((object) => object.destroy());
    const question = this.params.missed[this.pageIndex];
    this.counter.setText(`${this.pageIndex + 1}/${this.params.missed.length}`);
    const left = BOX.x + 20;
    const wrap = BOX.width - 40;
    const prompt = this.add.text(left, BOX.y + 20, question.prompt, textStyle(16, NES.white, wrap));
    const answer = this.add.text(
      left,
      prompt.y + prompt.height + 20,
      `Answer: ${CHOICE_LETTERS[question.answerIndex]}) ${question.choices[question.answerIndex]}`,
      textStyle(16, NES.lime, wrap),
    );
    const explanationTop = answer.y + answer.height + 20;
    const explanation = this.add.text(left, explanationTop, question.explanation, textStyle(16, NES.lightGray, wrap));
    fitTextToHeight(explanation, BOX.y + BOX.height - 16 - explanationTop);
    this.pageObjects = [prompt, answer, explanation];
  }
}
