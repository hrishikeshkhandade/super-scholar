import Phaser from "phaser";
import type { Paper } from "../content/types";
import { NES } from "../palette";
import { saveProgress } from "../save";
import { GAME_HEIGHT, GAME_WIDTH, HeartBar, Menu, START_LIVES, panel, textStyle } from "../ui";
import type { CutsceneData } from "./CutsceneScene";

export interface StageData {
  paper: Paper;
  worldIndex: number;
  checkpointsCleared: number;
  lives: number;
}

const GROUND_Y = 380;
const PLAYER_X = 120;
const GRAVITY = 2000;
const JUMP_VELOCITY = -760;
const BASE_SPEED = 280;
const MAX_SPEED = 400;
const SEGMENT_LENGTH = 3000; // distance run between flags
const MIN_GAP = 420;
const MAX_GAP = 800;
const INVULNERABLE_MS = 1200;

export class RunnerScene extends Phaser.Scene {
  private stage!: StageData;
  private player!: Phaser.GameObjects.Image;
  private velocityY = 0;
  private speed = BASE_SPEED;
  private segmentDistance = 0;
  private nextObstacleAt = 0;
  private obstacles: Phaser.GameObjects.Image[] = [];
  private clouds: Phaser.GameObjects.Image[] = [];
  private groundMarks: Phaser.GameObjects.Rectangle[] = [];
  private goal?: Phaser.GameObjects.Image;
  private invulnerableUntil = 0;
  private stopped = false;
  private hearts!: HeartBar;
  private progressFill!: Phaser.GameObjects.Rectangle;
  private progressLabel!: Phaser.GameObjects.Text;

  constructor() {
    super("Runner");
  }

  create(data: StageData): void {
    this.stage = { ...data };
    this.velocityY = 0;
    this.speed = BASE_SPEED;
    this.segmentDistance = 0;
    this.nextObstacleAt = 600;
    this.obstacles = [];
    this.clouds = [];
    this.groundMarks = [];
    this.goal = undefined;
    this.invulnerableUntil = 0;
    this.stopped = false;

    this.drawBackground();
    this.player = this.add.image(PLAYER_X, GROUND_Y, "runner").setOrigin(0.5, 1).setDepth(5);
    this.drawHud();

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if ([" ", "ArrowUp", "w", "W"].includes(event.key)) {
        event.preventDefault();
        this.jump();
      }
    });
    this.input.on("pointerdown", () => this.jump());
  }

  private get world() {
    return this.stage.paper.worlds[this.stage.worldIndex];
  }

  private get headingToBoss(): boolean {
    return this.stage.checkpointsCleared >= this.world.cutscenes.length;
  }

  private drawBackground(): void {
    this.cameras.main.setBackgroundColor(NES.sky);
    for (let i = 0; i < 4; i++) {
      const cloud = this.add.image(i * 230 + 60, Phaser.Math.Between(70, 180), "cloud");
      this.clouds.push(cloud);
    }
    this.add.rectangle(0, GROUND_Y, GAME_WIDTH, 8, NES.lime).setOrigin(0, 0);
    this.add.rectangle(0, GROUND_Y + 8, GAME_WIDTH, GAME_HEIGHT - GROUND_Y, NES.brown).setOrigin(0, 0);
    for (let i = 0; i < 12; i++) {
      const mark = this.add.rectangle(i * 70, GROUND_Y + 20 + (i % 3) * 16, 12, 4, NES.tan).setOrigin(0, 0);
      this.groundMarks.push(mark);
    }
  }

  private drawHud(): void {
    this.hearts = new HeartBar(this, 16, 16);
    this.hearts.set(this.stage.lives);
    this.add.text(GAME_WIDTH - 16, 16, this.world.name.toUpperCase(), textStyle(12, NES.navy)).setOrigin(1, 0);
    this.add.rectangle(GAME_WIDTH - 216, 40, 200, 12, NES.white).setOrigin(0, 0).setStrokeStyle(2, NES.navy);
    this.progressFill = this.add.rectangle(GAME_WIDTH - 216, 40, 0, 12, NES.yellow).setOrigin(0, 0);
    this.progressLabel = this.add.text(GAME_WIDTH - 16, 60, "", textStyle(8, NES.navy)).setOrigin(1, 0);
    this.updateProgress();
  }

  private updateProgress(): void {
    const total = this.world.cutscenes.length;
    const fraction = Math.min(this.segmentDistance / SEGMENT_LENGTH, 1);
    this.progressFill.width = 200 * fraction;
    this.progressLabel.setText(
      this.headingToBoss ? "NEXT: BOSS!" : `NEXT FLAG: ${this.stage.checkpointsCleared + 1} OF ${total}`,
    );
  }

  private jump(): void {
    if (this.stopped) return;
    if (this.player.y >= GROUND_Y) this.velocityY = JUMP_VELOCITY;
  }

  update(_time: number, deltaMs: number): void {
    if (this.stopped) return;
    const dt = Math.min(deltaMs / 1000, 0.05);
    const step = this.speed * dt;

    // Player physics, like Scratch: change y by velocity, velocity by gravity.
    this.velocityY += GRAVITY * dt;
    this.player.y = Math.min(this.player.y + this.velocityY * dt, GROUND_Y);
    if (this.player.y >= GROUND_Y) this.velocityY = 0;

    this.scrollScenery(step);
    this.segmentDistance += step;
    this.speed = Math.min(BASE_SPEED + this.segmentDistance * 0.03, MAX_SPEED);
    this.updateProgress();

    if (this.segmentDistance >= SEGMENT_LENGTH && !this.goal) this.spawnGoal();
    if (!this.goal && this.segmentDistance >= this.nextObstacleAt) this.spawnObstacle();

    for (const obstacle of [...this.obstacles]) {
      obstacle.x -= step;
      if (obstacle.x < -40) this.removeObstacle(obstacle);
      else if (this.time.now >= this.invulnerableUntil && this.touches(obstacle)) this.hit(obstacle);
    }

    if (this.goal) {
      this.goal.x -= step;
      if (this.goal.x <= PLAYER_X) this.reachGoal();
    }
  }

  private scrollScenery(step: number): void {
    for (const cloud of this.clouds) {
      cloud.x -= step * 0.2;
      if (cloud.x < -60) cloud.setPosition(GAME_WIDTH + 60, Phaser.Math.Between(70, 180));
    }
    for (const mark of this.groundMarks) {
      mark.x -= step;
      if (mark.x < -12) mark.x += 12 * 70;
    }
  }

  private spawnObstacle(): void {
    const candle = this.add
      .image(GAME_WIDTH + 30, GROUND_Y, "candle")
      .setOrigin(0.5, 1)
      .setScale(1, Phaser.Math.FloatBetween(0.8, 1.4));
    this.obstacles.push(candle);
    this.nextObstacleAt = this.segmentDistance + Phaser.Math.Between(MIN_GAP, MAX_GAP);
  }

  private removeObstacle(obstacle: Phaser.GameObjects.Image): void {
    this.obstacles = this.obstacles.filter((other) => other !== obstacle);
    obstacle.destroy();
  }

  private touches(obstacle: Phaser.GameObjects.Image): boolean {
    // Shrink both boxes a little so near-misses feel fair.
    const a = Phaser.Geom.Rectangle.Inflate(this.player.getBounds(), -6, -4);
    const b = Phaser.Geom.Rectangle.Inflate(obstacle.getBounds(), -4, -4);
    return Phaser.Geom.Intersects.RectangleToRectangle(a, b);
  }

  private hit(obstacle: Phaser.GameObjects.Image): void {
    this.removeObstacle(obstacle);
    this.stage.lives -= 1;
    this.hearts.set(this.stage.lives);
    this.cameras.main.shake(150, 0.01);
    if (this.stage.lives <= 0) {
      this.gameOver();
      return;
    }
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.tweens.add({ targets: this.player, alpha: 0.2, duration: 100, yoyo: true, repeat: 5 });
  }

  private spawnGoal(): void {
    const texture = this.headingToBoss ? "boss" : "flag";
    this.goal = this.add.image(GAME_WIDTH + 40, GROUND_Y, texture).setOrigin(0.5, 1).setScale(texture === "boss" ? 2 : 1.5);
  }

  private reachGoal(): void {
    this.goal?.destroy();
    this.goal = undefined;
    [...this.obstacles].forEach((obstacle) => this.removeObstacle(obstacle));
    if (this.headingToBoss) {
      this.stopped = true;
      this.add.text(GAME_WIDTH / 2, 180, "BOSS FIGHT!", textStyle(40, NES.red)).setOrigin(0.5);
      this.time.delayedCall(1200, () => this.scene.start("Boss", this.stage));
      return;
    }

    const cutscene = this.world.cutscenes[this.stage.checkpointsCleared];
    const data: CutsceneData = {
      cutscene,
      lives: this.stage.lives,
      onDone: (lives) => {
        this.stage.lives = lives;
        this.stage.checkpointsCleared += 1;
        saveProgress({
          paperId: this.stage.paper.id,
          worldIndex: this.stage.worldIndex,
          checkpointsCleared: this.stage.checkpointsCleared,
        });
        this.hearts.set(lives);
        this.segmentDistance = 0;
        this.nextObstacleAt = 600;
        this.updateProgress();
        this.scene.resume();
      },
    };
    this.scene.pause();
    this.scene.launch("Cutscene", data);
    this.scene.bringToTop("Cutscene");
  }

  private gameOver(): void {
    this.stopped = true;
    panel(this, 200, 110, 400, 230).setDepth(20);
    this.add.text(GAME_WIDTH / 2, 150, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5).setDepth(20);
    const menu = new Menu(this, 260, 220, [
      {
        label: "RETRY FROM FLAG",
        onSelect: () => this.scene.restart({ ...this.stage, lives: START_LIVES }),
      },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
    menu.setDepth(21);
  }
}
