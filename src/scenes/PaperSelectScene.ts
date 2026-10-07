import Phaser from "phaser";
import { audio } from "../audio/audio";
import { LIBRARY, searchPapers } from "../content/library";
import type { Paper } from "../content/types";
import { NES } from "../palette";
import { saveProgress } from "../save";
import { GAME_WIDTH, Menu, START_LIVES, textStyle } from "../ui";

const INPUT_BOX = { x: 40, y: 70, width: GAME_WIDTH - 80, height: 40 };

export class PaperSelectScene extends Phaser.Scene {
  private searchInput!: HTMLInputElement;
  private menu!: Menu;
  private emptyMessage!: Phaser.GameObjects.Text;

  constructor() {
    super("PaperSelect");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    audio.playMusic("title");
    this.add.text(GAME_WIDTH / 2, 36, "CHOOSE A PAPER", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 420, `${LIBRARY.length} paper in the library. More coming soon.`, textStyle(8, NES.lightGray))
      .setOrigin(0.5);
    this.emptyMessage = this.add
      .text(GAME_WIDTH / 2, 200, "No papers match.\n\nTry \"trading\" or \"Avellaneda\".", textStyle(12, NES.salmon))
      .setOrigin(0.5)
      .setAlign("center");
    this.menu = new Menu(this, 72, 140, [], { size: 12, spacing: 24, wrapWidth: GAME_WIDTH - 140 });

    this.searchInput = document.getElementById("search-input") as HTMLInputElement;
    this.searchInput.value = "";
    this.searchInput.hidden = false;
    this.positionInput();
    this.searchInput.focus();

    const onType = () => this.showResults(this.searchInput.value);
    const onResize = () => this.positionInput();
    this.searchInput.addEventListener("input", onType);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    window.addEventListener("resize", onResize);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.searchInput.hidden = true;
      this.searchInput.blur();
      this.searchInput.removeEventListener("input", onType);
      window.removeEventListener("resize", onResize);
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
    });

    this.showResults("");
  }

  private showResults(query: string): void {
    const results = searchPapers(query);
    this.emptyMessage.setVisible(results.length === 0);
    this.menu.setItems([
      ...results.map((paper) => ({
        label: `${paper.title}\n${paper.authors.join(", ")} (${paper.year}) - ${paper.subject}`,
        onSelect: () => this.startPaper(paper),
      })),
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
  }

  private startPaper(paper: Paper): void {
    saveProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 0 });
    this.scene.start("Cutscene", {
      cutscene: paper.intro,
      lives: START_LIVES,
      next: { scene: "Level", data: { paper, worldIndex: 0, checkpointsCleared: 0 } },
    });
  }

  // The search box is a real HTML input laid over the canvas, so it gets
  // native typing, paste, and the phone keyboard. Match it to the canvas scale.
  private positionInput(): void {
    const canvas = this.game.canvas.getBoundingClientRect();
    const container = this.searchInput.parentElement!.getBoundingClientRect();
    const scale = canvas.width / GAME_WIDTH;
    Object.assign(this.searchInput.style, {
      left: `${canvas.left - container.left + INPUT_BOX.x * scale}px`,
      top: `${canvas.top - container.top + INPUT_BOX.y * scale}px`,
      width: `${INPUT_BOX.width * scale}px`,
      height: `${INPUT_BOX.height * scale}px`,
      fontSize: `${Math.max(12, 12 * scale)}px`,
      borderWidth: `${Math.max(2, 4 * scale)}px`,
    });
  }
}
