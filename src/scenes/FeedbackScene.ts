import Phaser from "phaser";
import { audio } from "../audio/audio";
import { RATING_QUESTIONS, TEXT_QUESTIONS } from "../feedbackQuestions";
import { isTouchDevice } from "../touchControls";
import { GAME_HEIGHT, GAME_WIDTH } from "../ui";
import { PANEL_INNER, drawMenuBackdrop } from "./backdrop";

// The FEEDBACK screen for classmates trying the game. The form itself is the
// HTML in index.html, laid over the canvas so it gets native typing and the
// phone keyboard; this scene shows it, positions it, and sends the answers.


export class FeedbackScene extends Phaser.Scene {
  private form!: HTMLFormElement;
  private status!: HTMLElement;
  private sendButton!: HTMLButtonElement;
  private ratings: Partial<Record<(typeof RATING_QUESTIONS)[number], number>> = {};
  private sending = false;

  constructor() {
    super("Feedback");
  }

  create(): void {
    drawMenuBackdrop(this);
    this.form = document.getElementById("feedback-form") as HTMLFormElement;
    this.status = document.getElementById("feedback-status")!;
    this.sendButton = document.getElementById("feedback-send") as HTMLButtonElement;
    this.ratings = {};
    this.sending = false;
    this.resetForm();

    const back = () => this.scene.start("Title");
    const send = () => void this.send();
    const onResize = () => this.positionForm();
    // Enter in the name box would otherwise try to submit the form.
    const onSubmit = (event: Event) => event.preventDefault();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") back();
      // Keep game keys (like W/S for menus) from reaching Phaser while typing.
      event.stopPropagation();
    };
    const backButton = document.getElementById("feedback-back")!;
    this.sendButton.addEventListener("click", send);
    backButton.addEventListener("click", back);
    this.form.addEventListener("submit", onSubmit);
    this.form.addEventListener("keydown", onKey);
    window.addEventListener("resize", onResize);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    this.input.keyboard?.on("keydown-ESC", back);

    this.form.hidden = false;
    this.positionForm();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.form.hidden = true;
      this.sendButton.removeEventListener("click", send);
      backButton.removeEventListener("click", back);
      this.form.removeEventListener("submit", onSubmit);
      this.form.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", onResize);
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });
  }

  // Fresh form each visit: empty answers and a row of 1-5 buttons per rating.
  private resetForm(): void {
    this.form.reset();
    this.setStatus("");
    this.sendButton.disabled = false;
    this.sendButton.textContent = "SEND";
    for (const question of RATING_QUESTIONS) {
      const fieldset = this.form.querySelector(`fieldset[data-rating="${question}"]`)!;
      fieldset.querySelectorAll("button").forEach((button) => button.remove());
      for (let value = 1; value <= 5; value++) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = String(value);
        button.setAttribute("aria-pressed", "false");
        button.setAttribute("aria-label", `${value} out of 5`);
        button.addEventListener("click", () => {
          this.ratings[question] = value;
          audio.playSfx("move");
          fieldset.querySelectorAll("button").forEach((other) => other.setAttribute("aria-pressed", String(other === button)));
        });
        fieldset.append(button);
      }
    }
  }

  private setStatus(message: string, isError = false): void {
    this.status.textContent = message;
    this.status.classList.toggle("error", isError);
  }

  private async send(): Promise<void> {
    if (this.sending) return;
    const field = (name: string) => (this.form.elements.namedItem(name) as HTMLInputElement | HTMLTextAreaElement).value.trim();
    const answers = Object.fromEntries(TEXT_QUESTIONS.map((q) => [q, field(q)]).filter(([, answer]) => answer));
    if (Object.keys(this.ratings).length === 0 && Object.keys(answers).length === 0) {
      audio.playSfx("wrong");
      this.setStatus("Pick a rating or write an answer first.", true);
      return;
    }
    this.sending = true;
    this.sendButton.disabled = true;
    this.setStatus("Sending...");
    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ratings: this.ratings,
          answers,
          name: field("name") || undefined,
          device: isTouchDevice() ? "touch" : "keyboard",
        }),
      });
      if (!this.scene.isActive()) return;
      if (response.status === 429) throw new Error("Too many sends. Wait a minute and try again.");
      if (!response.ok) throw new Error("Couldn't send it. Try again in a moment.");
      audio.playSfx("powerup");
      this.setStatus("Thanks! Your feedback was sent.");
      this.sendButton.textContent = "SENT";
    } catch (failure) {
      if (!this.scene.isActive()) return;
      audio.playSfx("wrong");
      this.setStatus(failure instanceof Error && failure.message.startsWith("Too many") ? failure.message : "Couldn't send it. Check your connection and try again.", true);
      this.sendButton.disabled = false;
      this.sending = false;
    }
  }

  // Fit just inside the menu panel's border, so anything scrolled out of
  // view is clipped at the frame instead of spilling over it; the text
  // scales with the canvas.
  private positionForm(): void {
    const canvas = this.game.canvas.getBoundingClientRect();
    const container = this.form.parentElement!.getBoundingClientRect();
    const scale = canvas.width / GAME_WIDTH;
    Object.assign(this.form.style, {
      left: `${canvas.left - container.left + PANEL_INNER.x * scale}px`,
      top: `${canvas.top - container.top + PANEL_INNER.y * scale}px`,
      width: `${(GAME_WIDTH - PANEL_INNER.x * 2) * scale}px`,
      height: `${(GAME_HEIGHT - PANEL_INNER.y * 2) * scale}px`,
    });
    this.form.style.setProperty("--scale", String(Math.max(scale, 0.75)));
  }
}
