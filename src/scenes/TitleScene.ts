import Phaser from "phaser";
import { findPaper } from "../content/library";
import { NES } from "../palette";
import { loadProgress } from "../save";
import { GAME_WIDTH, Menu, START_LIVES, textStyle } from "../ui";

export class TitleScene extends Phaser.Scene {
  constructor() {
    super("Title");
  }

  create(): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.add.text(GAME_WIDTH / 2, 70, "PAPER QUEST", textStyle(40, NES.yellow)).setOrigin(0.5);
    this.add
      .text(GAME_WIDTH / 2, 125, "Research papers, but make it a game", textStyle(12, NES.sky))
      .setOrigin(0.5);
    this.add.image(GAME_WIDTH / 2 + 230, 300, "runner").setScale(2);
    this.add.image(GAME_WIDTH / 2 - 250, 300, "candle").setScale(2);

    const progress = loadProgress();
    const savedPaper = progress && findPaper(progress.paperId);
    const canContinue = savedPaper !== undefined && progress!.worldIndex < savedPaper.worlds.length;

    new Menu(this, 290, 200, [
      { label: "NEW GAME", onSelect: () => this.scene.start("PaperSelect") },
      {
        label: "CONTINUE",
        enabled: canContinue,
        onSelect: () => {
          const atBoss = progress!.checkpointsCleared >= savedPaper!.worlds[progress!.worldIndex].cutscenes.length;
          this.scene.start(atBoss ? "Boss" : "Runner", {
            paper: savedPaper,
            worldIndex: progress!.worldIndex,
            checkpointsCleared: progress!.checkpointsCleared,
            lives: START_LIVES,
          });
        },
      },
      { label: "SETTINGS", onSelect: () => this.scene.start("Settings") },
      { label: "ABOUT", onSelect: () => this.scene.start("About") },
    ]);

    this.add
      .text(GAME_WIDTH / 2, 420, "ARROWS + ENTER, OR CLICK / TAP", textStyle(8, NES.lightGray))
      .setOrigin(0.5);
  }
}
