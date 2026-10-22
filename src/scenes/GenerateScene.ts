import Phaser from "phaser";
import { audio } from "../audio/audio";
import { fetchAiWorlds } from "../generator/aiClient";
import { GenerateError, prepareGame, withAiWorlds } from "../generator/generateGame";
import { MAX_PDF_BYTES, MAX_PDF_PAGES, readPdfLines } from "../generator/readPdf";
import { startPaperOver } from "../levelMap";
import { NES, css } from "../palette";
import { saveUploadedPaper, startLives } from "../save";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

// Gets a paper's PDF (an upload, or a free copy downloaded by our server
// function) and builds a game from it in the browser.

export type PaperSource =
  | { file: File }
  | { download: { id: string; title: string; authors: string[]; year: number | undefined } };

const NOT_FOUND_TIP = "Try OPEN PAPER to get the PDF yourself, then upload it.";
// The AI step can take a minute, so the screen shows it's still working:
// what's happening (changing every few seconds) and the seconds so far.
const AI_STEPS = [
  "Turning sections into worlds",
  "Writing lessons in plain words",
  "Hiding fun facts under the bears",
  "Writing the boss's questions",
  "Naming the bosses",
  "Checking nothing is copied",
];
const AI_STEP_MS = 4000;
const PROFESSOR_Y = 116;

export class GenerateScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;
  private abort?: AbortController;
  private hint?: Phaser.GameObjects.Text;
  private waitNote!: Phaser.GameObjects.Text;
  private heading!: Phaser.GameObjects.Text;
  private professor!: Phaser.GameObjects.Image;

  constructor() {
    super("Generate");
  }

  create(data: PaperSource): void {
    drawMenuBackdrop(this);
    // Sits fully above the heading, even at the top of his bob.
    this.professor = this.add.image(GAME_WIDTH / 2, PROFESSOR_Y, "professor").setScale(3);
    this.tweens.add({ targets: this.professor, y: PROFESSOR_Y - 8, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.heading = this.add.text(GAME_WIDTH / 2, 230, "PROF. QUANT IS READING\nYOUR PAPER...", textStyle(24, NES.yellow)).setOrigin(0.5).setAlign("center");
    this.status = this.add.text(GAME_WIDTH / 2, 300, "Opening the PDF", textStyle(16, NES.white)).setOrigin(0.5);
    this.waitNote = this.add.text(GAME_WIDTH / 2, 330, "", textStyle(8, NES.lightGray)).setOrigin(0.5);
    // A slow download shouldn't trap the player on this screen. Esc, or a
    // tap on the hint, cancels.
    this.abort = new AbortController();
    const cancel = () => {
      this.abort?.abort();
      this.scene.start("PaperSelect");
    };
    const hint = this.add
      .text(GAME_WIDTH / 2, 420, isTouchDevice() ? "TAP HERE TO CANCEL" : "ESC: CANCEL", textStyle(8, NES.lightGray))
      .setOrigin(0.5)
      .setPadding(16, 12, 16, 12)
      .setInteractive({ useHandCursor: true })
      .once("pointerdown", cancel);
    this.input.keyboard?.once("keydown-ESC", cancel);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.abort?.abort());
    this.hint = hint;
    void this.build(data);
  }

  private async readUpload(file: File): Promise<ArrayBuffer> {
    if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
      throw new GenerateError("That file isn't a PDF. Pick a .pdf file.");
    }
    if (file.size > MAX_PDF_BYTES) throw new GenerateError("That PDF is too big (over 40 MB).");
    return file.arrayBuffer();
  }

  private async download(id: string): Promise<ArrayBuffer> {
    this.status.setText("Downloading the free PDF");
    const response = await fetch(`/api/fetch-paper?id=${encodeURIComponent(id)}`, { signal: this.abort?.signal }).catch(() => {
      throw new GenerateError("Couldn't connect to download the paper. Check your connection.");
    });
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      throw new GenerateError(`${body.error ?? "The download failed."} ${NOT_FOUND_TIP}`);
    }
    return response.arrayBuffer();
  }

  private async build(source: PaperSource): Promise<void> {
    try {
      const data = "file" in source ? await this.readUpload(source.file) : await this.download(source.download.id);
      const fileName = "file" in source ? source.file.name : `${source.download.title}.pdf`;
      if (!this.scene.isActive()) return;

      const lines = await readPdfLines(data, (page, pages) => {
        if (this.scene.isActive()) this.status.setText(`Reading page ${page} of ${pages}`);
      });
      if (!this.scene.isActive()) return;
      this.status.setText("Building your levels");
      // The rules version first, as a fallback that always works; then the
      // AI rewrites its worlds in plain words if it can.
      const prepared = prepareGame(lines, fileName);
      const progress = this.showAiProgress();
      const aiWorlds = await fetchAiWorlds(prepared.aiRequest, this.abort!.signal);
      progress.remove();
      if (!this.scene.isActive()) return;
      const generated = withAiWorlds(prepared, aiWorlds);
      // For downloads, the database knows the real title, authors, and year.
      const paper =
        "download" in source
          ? {
              ...generated,
              title: source.download.title,
              authors: source.download.authors,
              year: source.download.year ?? generated.year,
            }
          : generated;
      saveUploadedPaper(paper);
      startPaperOver(paper);
      audio.playSfx("powerup");
      this.scene.start("Cutscene", {
        cutscene: paper.intro,
        lives: startLives(),
        next: { scene: "Level", data: { paper, worldIndex: 0, checkpointsCleared: 0 } },
      });
    } catch (error) {
      if (!this.scene.isActive()) return;
      // pdf.js errors are technical, so show a plain message for those, with
      // the technical one in small print to help track down bugs.
      if (error instanceof GenerateError) return this.showError(error.message);
      console.error(error);
      const details = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
      this.showError("Couldn't read this PDF. It may be damaged or password-protected.", details);
    }
  }

  // Ticks every second: the current step and how long it's been.
  private showAiProgress(): Phaser.Time.TimerEvent {
    const started = this.time.now;
    const update = () => {
      const elapsedMs = this.time.now - started;
      const step = AI_STEPS[Math.floor(elapsedMs / AI_STEP_MS) % AI_STEPS.length];
      this.status.setText(`${step}... ${Math.floor(elapsedMs / 1000)}s`);
    };
    update();
    this.waitNote.setText("The AI is writing your game. This can take up to a minute.");
    return this.time.addEvent({ delay: 1000, loop: true, callback: update });
  }

  private showError(message: string, details?: string): void {
    this.hint?.destroy();
    this.waitNote.setText("");
    // He's stopped reading, so the screen shouldn't say he still is.
    this.tweens.killTweensOf(this.professor);
    this.professor.setY(PROFESSOR_Y);
    this.heading.setText("PROF. QUANT\nHIT A SNAG").setColor(css(NES.salmon));
    audio.playSfx("wrong");
    this.status.setText("");
    const error = this.add
      .text(GAME_WIDTH / 2, 280, message, textStyle(16, NES.salmon, GAME_WIDTH - 120))
      .setOrigin(0.5, 0)
      .setAlign("center");
    const tipText = `Text-based PDFs up to ${MAX_PDF_PAGES} pages work best.`;
    const tip = this.add
      .text(GAME_WIDTH / 2, error.y + error.height + 12, details ? `${tipText}\nDetails: ${details.slice(0, 140)}` : tipText, textStyle(8, NES.lightGray, GAME_WIDTH - 80))
      .setOrigin(0.5, 0)
      .setAlign("center");
    new Menu(this, 300, tip.y + tip.height + 16, [{ label: "BACK TO PAPERS", onSelect: () => this.scene.start("PaperSelect") }]);
  }
}
