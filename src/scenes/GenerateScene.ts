import Phaser from "phaser";
import { audio } from "../audio/audio";
import { GenerateError, generateGame } from "../generator/generateGame";
import { MAX_PDF_BYTES, MAX_PDF_PAGES, readPdfLines } from "../generator/readPdf";
import { NES } from "../palette";
import { saveProgress, saveUploadedPaper } from "../save";
import { GAME_WIDTH, Menu, START_LIVES, textStyle } from "../ui";

// Reads an uploaded PDF and builds a game from it, all in the browser.

export class GenerateScene extends Phaser.Scene {
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super("Generate");
  }

  create(data: { file: File }): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    const professor = this.add.image(GAME_WIDTH / 2, 140, "professor").setScale(3);
    this.tweens.add({ targets: professor, y: 130, duration: 400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.add.text(GAME_WIDTH / 2, 230, "PROF. QUANT IS READING\nYOUR PAPER...", textStyle(24, NES.yellow)).setOrigin(0.5).setAlign("center");
    this.status = this.add.text(GAME_WIDTH / 2, 300, "Opening the PDF", textStyle(16, NES.white)).setOrigin(0.5);
    void this.build(data.file);
  }

  private async build(file: File): Promise<void> {
    try {
      if (!/\.pdf$/i.test(file.name) && file.type !== "application/pdf") {
        throw new GenerateError("That file isn't a PDF. Pick a .pdf file.");
      }
      if (file.size > MAX_PDF_BYTES) throw new GenerateError("That PDF is too big (over 40 MB).");

      const lines = await readPdfLines(await file.arrayBuffer(), (page, pages) => {
        if (this.scene.isActive()) this.status.setText(`Reading page ${page} of ${pages}`);
      });
      if (!this.scene.isActive()) return;
      this.status.setText("Building your levels");
      const paper = generateGame(lines, file.name);
      saveUploadedPaper(paper);
      saveProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 0 });
      audio.playSfx("powerup");
      this.scene.start("Cutscene", {
        cutscene: paper.intro,
        lives: START_LIVES,
        next: { scene: "Level", data: { paper, worldIndex: 0, checkpointsCleared: 0 } },
      });
    } catch (error) {
      if (!this.scene.isActive()) return;
      // pdf.js errors are technical, so show a plain message for those.
      const message =
        error instanceof GenerateError
          ? error.message
          : "Couldn't read this PDF. It may be damaged or password-protected.";
      this.showError(message);
    }
  }

  private showError(message: string): void {
    audio.playSfx("wrong");
    this.status.setText("");
    this.add
      .text(GAME_WIDTH / 2, 300, message, textStyle(16, NES.salmon, GAME_WIDTH - 120))
      .setOrigin(0.5, 0)
      .setAlign("center");
    this.add
      .text(GAME_WIDTH / 2, 360, `Tip: text-based PDFs up to ${MAX_PDF_PAGES} pages work best.`, textStyle(8, NES.lightGray))
      .setOrigin(0.5, 0);
    new Menu(this, 300, 390, [{ label: "BACK TO PAPERS", onSelect: () => this.scene.start("PaperSelect") }]);
  }
}
