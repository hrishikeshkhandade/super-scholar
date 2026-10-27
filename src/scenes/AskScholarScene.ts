import Phaser from "phaser";
import { audio } from "../audio/audio";
import type { Cutscene } from "../content/types";
import { showOverGame } from "../htmlOverlay";
import { NES, css } from "../palette";
import { TEXT_SPEED_MS, loadSettings } from "../save";
import { QUESTIONS_PER_LESSON } from "../scholar";
import { askScholar } from "../scholarClient";
import { GAME_HEIGHT, GAME_WIDTH, READING, fitTextToHeight, panel, textStyle } from "../ui";
import { drawBackdrop } from "./backdrop";

// Ask the Scholar: after a lesson, the player types a question and the
// professor answers it (a free AI on the server writes the answer). It runs
// on top of the paused lesson and hands control back with onDone.

export interface AskScholarData {
  paperTitle: string;
  cutscene: Cutscene;
  onDone: () => void;
}

// Beside the professor, like the lessons, so answers come in short lines.
const SPEECH_BOX = { x: 200, y: 228, width: GAME_WIDTH - 220, height: 214 }; // fits 7 short lines
const PROFESSOR = { x: 104, y: 314 }; // standing on the ground, left of the box
const QUESTION_BOX = { x: 200, y: 88, width: GAME_WIDTH - 220, height: 124 };
const HEADING_Y = 24;
const ABOUT_Y = 56;
const THINKING_DOT_MS = 350;
const PLACEHOLDER = "e.g. Why does this matter?"; // one line, even on phones
const NO_QUESTIONS_LEFT = "All asked! Press DONE.";

export class AskScholarScene extends Phaser.Scene {
  private params!: AskScholarData;
  private form!: HTMLFormElement;
  private textArea!: HTMLTextAreaElement;
  private askButton!: HTMLButtonElement;
  private questionsLeft = QUESTIONS_PER_LESSON;
  private speech!: Phaser.GameObjects.Text;
  private typing?: Phaser.Time.TimerEvent;
  private waiting = false;

  constructor() {
    super("AskScholar");
  }

  create(data: AskScholarData): void {
    this.params = data;
    this.questionsLeft = QUESTIONS_PER_LESSON;
    this.waiting = false;

    // The same look as the lesson it came from.
    drawBackdrop(this);
    this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.6).setOrigin(0, 0);
    this.add.image(PROFESSOR.x, PROFESSOR.y, "professor").setScale(3);
    this.add.text(200, HEADING_Y, "ASK THE SCHOLAR", textStyle(24, NES.yellow));
    const about = this.add.text(200, ABOUT_Y, `About: ${data.cutscene.title}`, textStyle(16, NES.lightGray, QUESTION_BOX.width));
    fitTextToHeight(about, QUESTION_BOX.y - ABOUT_Y - 12);

    panel(this, SPEECH_BOX.x, SPEECH_BOX.y, SPEECH_BOX.width, SPEECH_BOX.height);
    this.add
      .text(SPEECH_BOX.x + 20, SPEECH_BOX.y - 8, ` ${data.cutscene.speaker} `, textStyle(16, NES.sky))
      .setBackgroundColor("#000000");
    this.speech = this.add.text(SPEECH_BOX.x + 20, SPEECH_BOX.y + 20, "", textStyle(16, NES.white, READING.width));
    this.say("Ask me anything about this lesson! Type your question above, then press ASK.");

    this.setUpForm();
  }

  private setUpForm(): void {
    this.form = document.getElementById("ask-form") as HTMLFormElement;
    this.textArea = this.form.elements.namedItem("question") as HTMLTextAreaElement;
    this.askButton = document.getElementById("ask-send") as HTMLButtonElement;
    const doneButton = document.getElementById("ask-done")!;
    this.form.reset();
    this.textArea.disabled = false;
    this.textArea.placeholder = PLACEHOLDER;
    this.askButton.disabled = false;
    this.updateQuestionsLeft();

    const ask = () => void this.ask();
    const done = () => this.done();
    const onSubmit = (event: Event) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" && event.target === this.textArea) {
        event.preventDefault(); // Enter asks instead of starting a new line
        ask();
      } else if (event.key === "Escape") {
        done();
      }
      // Keep typing (W, A, S, D, Space...) from reaching the game.
      event.stopPropagation();
    };
    this.askButton.addEventListener("click", ask);
    doneButton.addEventListener("click", done);
    this.form.addEventListener("submit", onSubmit);
    this.form.addEventListener("keydown", onKey);
    showOverGame(this, this.form, QUESTION_BOX);
    this.textArea.focus();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.askButton.removeEventListener("click", ask);
      doneButton.removeEventListener("click", done);
      this.form.removeEventListener("submit", onSubmit);
      this.form.removeEventListener("keydown", onKey);
    });
  }

  private async ask(): Promise<void> {
    if (this.waiting || this.questionsLeft <= 0) return;
    const question = this.textArea.value.trim();
    if (!question) {
      audio.playSfx("wrong");
      this.say("Type a question first, then press ASK.");
      this.textArea.focus();
      return;
    }
    this.waiting = true;
    this.askButton.disabled = true;
    audio.playSfx("select");
    const thinking = this.showThinking();
    const { cutscene, paperTitle } = this.params;
    const reply = await askScholar({
      paperTitle,
      lessonTitle: cutscene.title,
      lesson: cutscene.pages.join("\n"),
      question,
    });
    thinking.remove();
    if (!this.scene.isActive()) return;
    this.waiting = false;
    if ("answer" in reply) {
      // Only questions that got an answer count toward the limit.
      this.questionsLeft -= 1;
      this.textArea.value = "";
      this.say(reply.answer);
    } else {
      audio.playSfx("wrong");
      this.say(reply.problem, NES.salmon);
    }
    this.updateQuestionsLeft();
  }

  private showThinking(): Phaser.Time.TimerEvent {
    this.typing?.remove();
    this.speech.setColor(css(NES.lightGray));
    let dots = 0;
    this.speech.setText("Hmm, let me think");
    return this.time.addEvent({
      delay: THINKING_DOT_MS,
      loop: true,
      callback: () => {
        dots = (dots + 1) % 4;
        this.speech.setText(`Hmm, let me think${".".repeat(dots)}`);
      },
    });
  }

  // Types the professor's words out in the speech box, like the lessons do.
  private say(text: string, color: number = NES.white): void {
    this.typing?.remove();
    // Measure the whole text first, so the typing never runs past the box.
    this.speech.setText(text);
    fitTextToHeight(this.speech, SPEECH_BOX.y + SPEECH_BOX.height - 12 - this.speech.y);
    text = this.speech.text;
    this.speech.setColor(css(color)).setText("");
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: TEXT_SPEED_MS[loadSettings().textSpeed],
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.speech.setText(text.slice(0, shown));
        if (shown % 3 === 0) audio.playSfx("text");
      },
    });
  }

  private updateQuestionsLeft(): void {
    const left = this.questionsLeft;
    const label = document.getElementById("ask-left")!;
    label.textContent = left > 0 ? `${left} question${left === 1 ? "" : "s"} left` : "No questions left";
    if (left > 0) {
      this.askButton.disabled = this.waiting;
      return;
    }
    this.askButton.disabled = true;
    this.textArea.disabled = true;
    this.textArea.value = "";
    this.textArea.placeholder = NO_QUESTIONS_LEFT;
  }

  private done(): void {
    if (!this.scene.isActive()) return;
    audio.playSfx("select");
    const { onDone } = this.params;
    this.scene.stop();
    onDone();
  }
}
