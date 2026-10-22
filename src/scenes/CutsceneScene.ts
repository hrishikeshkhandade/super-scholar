import Phaser from "phaser";
import { audio } from "../audio/audio";
import type { Cutscene, Question } from "../content/types";
import { NES } from "../palette";
import { TEXT_SPEED_MS, loadSettings } from "../save";
import { isTouchDevice } from "../touchControls";
import { GAME_HEIGHT, GAME_WIDTH, MAX_LIVES, Menu, QuestionPanel, fitTextToHeight, onceAdvance, panel, textStyle } from "../ui";
import type { AskScholarData } from "./AskScholarScene";
import { recordAnswer } from "../run";
import { drawBackdrop } from "./backdrop";

export interface CutsceneData {
  cutscene: Cutscene;
  lives: number;
  // Either start another scene when done, or hand control back to the caller
  // (the runner, which is paused underneath this scene).
  next?: { scene: string; data: object };
  onDone?: (lives: number) => void;
  // The paper's title, for lessons the player can ask the Scholar about.
  askAbout?: string;
  // The leaderboard run's record of this lesson's practice question.
  runQuestion?: { paperId: string; key: string };
}

const BOX = { x: 20, y: 250, width: GAME_WIDTH - 40, height: 180 };
const AFTER_PRACTICE_MENU_Y = 372;

const FORWARD_KEYS = [" ", "Enter", "d", "D", "s", "S", "ArrowRight", "ArrowDown"];
const BACK_KEYS = ["a", "A", "w", "W", "ArrowLeft", "ArrowUp"];
// On phones, a tap on the left third of the screen goes back a page.
const BACK_TAP_WIDTH = GAME_WIDTH / 3;

export class CutsceneScene extends Phaser.Scene {
  private params!: CutsceneData;
  private lives = 0;
  private body!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;
  private pageCounter!: Phaser.GameObjects.Text;
  private pageIndex = 0;
  private furthestShown = -1; // highest page shown in full so far
  private typing?: Phaser.Time.TimerEvent;
  private onPages = false;

  constructor() {
    super("Cutscene");
  }

  create(data: CutsceneData): void {
    this.params = data;
    this.lives = data.lives;
    this.pageIndex = 0;
    this.furthestShown = -1;
    this.onPages = true;

    drawBackdrop(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.6).setOrigin(0, 0);
    this.add.image(110, 160, "professor").setScale(3);
    this.add.text(200, 120, data.cutscene.title.toUpperCase(), textStyle(24, NES.yellow, GAME_WIDTH - 220));

    panel(this, BOX.x, BOX.y, BOX.width, BOX.height);
    this.add.text(BOX.x + 20, BOX.y - 8, ` ${data.cutscene.speaker} `, textStyle(16, NES.sky)).setBackgroundColor("#000000");
    this.body = this.add.text(BOX.x + 20, BOX.y + 24, "", textStyle(16, NES.white, BOX.width - 40));
    this.pageCounter = this.add.text(BOX.x + 20, BOX.y + BOX.height - 14, "", textStyle(8, NES.lightGray)).setOrigin(0, 1);
    this.prompt = this.add
      .text(BOX.x + BOX.width - 16, BOX.y + BOX.height - 14, "", textStyle(8, NES.yellow))
      .setOrigin(1, 1);
    this.tweens.add({ targets: this.prompt, alpha: 0, duration: 400, yoyo: true, repeat: -1 });

    // Listen from the next frame, so the press that opened this cutscene
    // doesn't also skip its first page.
    const onKey = (event: KeyboardEvent) => this.handleKey(event);
    const touch = isTouchDevice();
    const onClick = (pointer: Phaser.Input.Pointer) => {
      if (!this.onPages) return;
      if (touch && pointer.x < BACK_TAP_WIDTH) this.back();
      else this.forward();
    };
    this.time.delayedCall(0, () => {
      this.input.keyboard?.on("keydown", onKey);
      this.input.on("pointerdown", onClick);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", onKey);
      this.input.off("pointerdown", onClick);
    });

    this.showPage(0);
  }

  // Forward: D, S, right/down arrow, Space, Enter, or click.
  // Back: A, W, left/up arrow, to reread a page skipped by accident.
  private handleKey(event: KeyboardEvent): void {
    if (!this.onPages || event.repeat) return;
    if (FORWARD_KEYS.includes(event.key)) this.forward();
    else if (BACK_KEYS.includes(event.key)) this.back();
    else return;
    event.preventDefault();
  }

  private forward(): void {
    if (this.typing) this.finishTyping();
    else this.showPage(this.pageIndex + 1);
  }

  private back(): void {
    if (this.pageIndex > 0) this.showPage(this.pageIndex - 1);
    else if (this.typing) this.finishTyping();
  }

  private showPage(index: number): void {
    const pages = this.params.cutscene.pages;
    if (index >= pages.length) {
      this.onPages = false;
      const practice = this.params.cutscene.practice;
      if (practice) this.askPractice(practice);
      else this.finish();
      return;
    }

    this.typing?.remove();
    this.typing = undefined;
    this.pageIndex = index;
    this.pageCounter.setText(`${index + 1}/${pages.length}`);
    const text = pages[index];

    // Pages already read appear instantly; new pages type out.
    if (index <= this.furthestShown) {
      this.finishTyping();
      return;
    }
    this.body.setText("");
    this.prompt.setText(isTouchDevice() ? "TAP: SKIP" : "SPACE / D: SKIP");
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: TEXT_SPEED_MS[loadSettings().textSpeed],
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.body.setText(text.slice(0, shown));
        if (shown % 3 === 0) audio.playSfx("text");
        if (shown >= text.length) this.finishTyping();
      },
    });
  }

  private finishTyping(): void {
    this.typing?.remove();
    this.typing = undefined;
    this.body.setText(this.params.cutscene.pages[this.pageIndex]);
    this.furthestShown = Math.max(this.furthestShown, this.pageIndex);
    const isLast = this.pageIndex === this.params.cutscene.pages.length - 1;
    const touch = isTouchDevice();
    const back = this.pageIndex > 0 ? (touch ? "TAP LEFT: BACK   " : "A: BACK   ") : "";
    this.prompt.setText(`${back}${touch ? "TAP" : "SPACE / D"}: ${isLast ? "DONE" : "NEXT"}`);
  }

  private askPractice(question: Question): void {
    this.children.removeAll(true);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.85).setOrigin(0, 0);
    this.add.text(GAME_WIDTH / 2, 50, "PRACTICE!", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 90, "Get it right to earn a life", textStyle(16, NES.lime))
      .setOrigin(0.5);

    const questionPanel = new QuestionPanel(this, question, 130, (choiceIndex) => {
      questionPanel.destroy();
      const correct = choiceIndex === question.answerIndex;
      const { runQuestion } = this.params;
      if (runQuestion) recordAnswer(runQuestion.paperId, runQuestion.key, correct);
      audio.playSfx(correct ? "correct" : "wrong");
      let heading = correct ? "CORRECT!" : "NOT QUITE.";
      if (correct && this.lives < MAX_LIVES) {
        this.lives += 1;
        heading += " +1 LIFE";
      }
      const answer = `Answer: ${question.choices[question.answerIndex]}`;
      this.add.text(40, 150, heading, textStyle(24, correct ? NES.lime : NES.salmon));
      const explanation = this.add.text(40, 210, `${answer}\n\n${question.explanation}`, textStyle(16, NES.white, GAME_WIDTH - 80));
      const { askAbout } = this.params;
      if (!askAbout) {
        this.add.text(GAME_WIDTH - 40, 410, "SPACE / TAP", textStyle(8, NES.yellow)).setOrigin(1, 1);
        onceAdvance(this, () => this.finish());
        return;
      }
      fitTextToHeight(explanation, AFTER_PRACTICE_MENU_Y - 16 - explanation.y);
      // Next frame, so the key that answered can't also pick from this menu.
      this.time.delayedCall(0, () => this.offerScholar(askAbout));
    });
  }

  // CONTINUE comes first, so Space still moves on as before.
  private offerScholar(paperTitle: string): void {
    new Menu(this, GAME_WIDTH / 2 - 120, AFTER_PRACTICE_MENU_Y, [
      { label: "CONTINUE", onSelect: () => this.finish() },
      { label: "ASK THE SCHOLAR", onSelect: () => this.openScholar(paperTitle) },
    ], { spacing: 12 });
  }

  // The Scholar runs on top of this paused scene, and the lesson finishes
  // when the player is done asking.
  private openScholar(paperTitle: string): void {
    const data: AskScholarData = {
      paperTitle,
      cutscene: this.params.cutscene,
      onDone: () => {
        this.scene.resume();
        this.finish();
      },
    };
    this.scene.launch("AskScholar", data);
    this.scene.pause();
  }

  private finish(): void {
    const { next, onDone } = this.params;
    if (next) {
      this.scene.start(next.scene, { ...next.data, lives: this.lives });
    } else {
      onDone?.(this.lives);
      this.scene.stop();
    }
  }
}
