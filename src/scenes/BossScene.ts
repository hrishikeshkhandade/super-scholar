import Phaser from "phaser";
import { BossFight } from "../bossFight";
import { NES } from "../palette";
import { clearProgress, saveProgress } from "../save";
import { GAME_WIDTH, HeartBar, Menu, QuestionPanel, START_LIVES, onceAdvance, panel, textStyle } from "../ui";
import type { StageData } from "./RunnerScene";

const PANEL_TOP = 200;
const BAR = { x: 480, y: 40, width: 300, height: 16 };

export class BossScene extends Phaser.Scene {
  private stage!: StageData;
  private fight!: BossFight;
  private boss!: Phaser.GameObjects.Image;
  private player!: Phaser.GameObjects.Image;
  private hearts!: HeartBar;
  private healthFill!: Phaser.GameObjects.Rectangle;
  private feedback: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super("Boss");
  }

  create(data: StageData): void {
    this.stage = data;
    const world = data.paper.worlds[data.worldIndex];
    this.fight = new BossFight(world.boss.questions, data.lives);
    this.feedback = [];

    this.cameras.main.setBackgroundColor(NES.black);
    this.add.rectangle(0, 170, GAME_WIDTH, 30, NES.purple).setOrigin(0, 0);
    this.player = this.add.image(140, 170, "runner").setOrigin(0.5, 1).setScale(2.5);
    this.boss = this.add.image(640, 170, "boss").setOrigin(0.5, 1).setScale(1.8);
    this.tweens.add({ targets: this.boss, y: 160, duration: 600, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });

    this.hearts = new HeartBar(this, 16, 16);
    this.hearts.set(this.fight.lives);
    this.add.text(BAR.x, 16, world.boss.name, textStyle(12, NES.salmon));
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.gray).setOrigin(0, 0).setStrokeStyle(2, NES.white);
    this.healthFill = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.red).setOrigin(0, 0);

    this.askNext();
  }

  private askNext(): void {
    const question = this.fight.current;
    if (!question) {
      if (this.fight.outcome === "won") this.win();
      else this.lose();
      return;
    }
    const questionPanel = new QuestionPanel(this, question, PANEL_TOP, (choiceIndex) => {
      questionPanel.destroy();
      const correct = this.fight.answer(choiceIndex);
      this.showFeedback(correct, question.choices[question.answerIndex], question.explanation);
    });
  }

  private showFeedback(correct: boolean, answer: string, explanation: string): void {
    if (correct) {
      this.tweens.add({ targets: this.healthFill, width: (BAR.width * this.fight.health) / this.fight.maxHealth, duration: 300 });
      this.flash(this.boss);
      this.cameras.main.shake(200, 0.01);
    } else {
      this.hearts.set(this.fight.lives);
      this.flash(this.player);
    }

    const heading = correct ? "HIT! BOSS TAKES DAMAGE" : "OUCH! YOU LOSE A LIFE";
    const detail = correct ? explanation : `Answer: ${answer}\n\n${explanation}`;
    this.feedback = [
      panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230),
      this.add.text(40, PANEL_TOP + 20, heading, textStyle(16, correct ? NES.lime : NES.salmon)),
      this.add.text(40, PANEL_TOP + 60, detail, textStyle(12, NES.white, GAME_WIDTH - 80)),
      this.add.text(GAME_WIDTH - 40, PANEL_TOP + 214, "SPACE / TAP", textStyle(8, NES.yellow)).setOrigin(1, 1),
    ];
    onceAdvance(this, () => {
      this.feedback.forEach((object) => object.destroy());
      this.feedback = [];
      this.askNext();
    });
  }

  private flash(target: Phaser.GameObjects.Image): void {
    this.tweens.add({ targets: target, alpha: 0.2, duration: 80, yoyo: true, repeat: 3 });
  }

  private win(): void {
    const { paper, worldIndex } = this.stage;
    const nextWorld = worldIndex + 1;
    const hasNextWorld = nextWorld < paper.worlds.length;
    if (hasNextWorld) saveProgress({ paperId: paper.id, worldIndex: nextWorld, checkpointsCleared: 0 });
    else clearProgress();

    this.tweens.killTweensOf(this.boss);
    this.tweens.add({ targets: this.boss, alpha: 0, angle: 90, y: 220, duration: 800 });
    panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230);
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 40, "WORLD CLEAR!", textStyle(32, NES.yellow)).setOrigin(0.5);
    const message = hasNextWorld
      ? "You beat the boss. On to the next section of the paper!"
      : "You beat every world in this paper. More worlds are coming soon!";
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 90, message, textStyle(12, NES.white, GAME_WIDTH - 100)).setOrigin(0.5);
    new Menu(this, 280, PANEL_TOP + 140, [
      ...(hasNextWorld
        ? [
            {
              label: "NEXT WORLD",
              onSelect: () =>
                this.scene.start("Runner", { paper, worldIndex: nextWorld, checkpointsCleared: 0, lives: START_LIVES }),
            },
          ]
        : []),
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }

  private lose(): void {
    panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230);
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 50, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5);
    new Menu(this, 280, PANEL_TOP + 110, [
      { label: "RETRY BOSS", onSelect: () => this.scene.restart({ ...this.stage, lives: START_LIVES }) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
