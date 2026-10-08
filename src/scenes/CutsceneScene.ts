import Phaser from "phaser";
import { audio } from "../audio/audio";
import type { Cutscene, Question } from "../content/types";
import { NES } from "../palette";
import { TEXT_SPEED_MS, loadSettings } from "../save";
import { GAME_HEIGHT, GAME_WIDTH, MAX_LIVES, QuestionPanel, onceAdvance, panel, textStyle } from "../ui";

export interface CutsceneData {
  cutscene: Cutscene;
  lives: number;
  // Either start another scene when done, or hand control back to the caller
  // (the runner, which is paused underneath this scene).
  next?: { scene: string; data: object };
  onDone?: (lives: number) => void;
}

const BOX = { x: 20, y: 250, width: GAME_WIDTH - 40, height: 180 };

export class CutsceneScene extends Phaser.Scene {
  private params!: CutsceneData;
  private lives = 0;
  private body!: Phaser.GameObjects.Text;
  private prompt!: Phaser.GameObjects.Text;

  constructor() {
    super("Cutscene");
  }

  create(data: CutsceneData): void {
    this.params = data;
    this.lives = data.lives;

    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.75).setOrigin(0, 0);
    this.add.image(110, 160, "professor").setScale(3);
    this.add.text(200, 120, data.cutscene.title.toUpperCase(), textStyle(24, NES.yellow, GAME_WIDTH - 220));

    panel(this, BOX.x, BOX.y, BOX.width, BOX.height);
    this.add.text(BOX.x + 20, BOX.y - 8, ` ${data.cutscene.speaker} `, textStyle(16, NES.sky)).setBackgroundColor("#000000");
    this.body = this.add.text(BOX.x + 20, BOX.y + 24, "", textStyle(16, NES.white, BOX.width - 40));
    this.prompt = this.add
      .text(BOX.x + BOX.width - 16, BOX.y + BOX.height - 14, "SPACE / TAP", textStyle(8, NES.yellow))
      .setOrigin(1, 1);
    this.tweens.add({ targets: this.prompt, alpha: 0, duration: 400, yoyo: true, repeat: -1 });

    this.showPage(0);
  }

  private showPage(index: number): void {
    const pages = this.params.cutscene.pages;
    if (index >= pages.length) {
      const practice = this.params.cutscene.practice;
      if (practice) this.askPractice(practice);
      else this.finish();
      return;
    }

    const text = pages[index];
    const msPerChar = TEXT_SPEED_MS[loadSettings().textSpeed];
    let shown = 0;
    let typingDone = false;
    this.body.setText("");
    this.prompt.setVisible(false);

    // Show the whole page; the next press moves on to the next page.
    const finishTyping = () => {
      if (typingDone) return;
      typingDone = true;
      typing.remove();
      cancelSkip();
      this.body.setText(text);
      this.prompt.setVisible(true);
      onceAdvance(this, () => this.showPage(index + 1));
    };
    // Pressing while the text is still typing skips to the full page.
    const cancelSkip = onceAdvance(this, finishTyping);
    const typing = this.time.addEvent({
      delay: msPerChar,
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.body.setText(text.slice(0, shown));
        if (shown % 3 === 0) audio.playSfx("text");
        if (shown >= text.length) finishTyping();
      },
    });
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
      audio.playSfx(correct ? "correct" : "wrong");
      let heading = correct ? "CORRECT!" : "NOT QUITE.";
      if (correct && this.lives < MAX_LIVES) {
        this.lives += 1;
        heading += " +1 LIFE";
      }
      const answer = `Answer: ${question.choices[question.answerIndex]}`;
      this.add.text(40, 150, heading, textStyle(24, correct ? NES.lime : NES.salmon));
      this.add.text(40, 210, `${answer}\n\n${question.explanation}`, textStyle(16, NES.white, GAME_WIDTH - 80));
      this.add.text(GAME_WIDTH - 40, 410, "SPACE / TAP", textStyle(8, NES.yellow)).setOrigin(1, 1);
      onceAdvance(this, () => this.finish());
    });
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
