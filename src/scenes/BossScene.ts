import Phaser from "phaser";
import { audio } from "../audio/audio";
import { BossFight } from "../bossFight";
import { LIBRARY } from "../content/library";
import { TILE } from "../levels/parseLevel";
import { farKey } from "../levels/themeTextures";
import { THEMES } from "../levels/themes";
import { NES } from "../palette";
import { GRAVITY, JUMP_VELOCITY, PlayerController, makeOneWay, type Sprite } from "../player";
import { clearProgress, saveProgress } from "../save";
import type { StageData } from "../stage";
import { enablePause } from "./PauseScene";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HeartBar,
  Menu,
  QuestionPanel,
  START_LIVES,
  onceAdvance,
  panel,
  textStyle,
} from "../ui";

// The boss fight is an arena: dodge the boss's charges and falling candles,
// and stomp it to pause the fight for a question. Right answers damage it.

type Mode = "intro" | "walk" | "telegraph" | "charge" | "stunned" | "question" | "over";
type StaticSprite = Phaser.Types.Physics.Arcade.SpriteWithStaticBody;

const FLOOR_Y = 12 * TILE;
const PANEL_TOP = 200;
const BAR = { x: 480, y: 34, width: 300, height: 16 };
const INTRO_MS = 2000;
const TELEGRAPH_MS = 700;
const STUN_MS = 900;
const CANDLE_WARNING_MS = 800;
const PLAYER_INVULNERABLE_MS = 1200;
const STOMP_COOLDOWN_MS = 1500;

interface PendingDrop {
  x: number;
  remainingMs: number;
  marker: Phaser.GameObjects.Rectangle;
}

export class BossScene extends Phaser.Scene {
  private stage!: StageData;
  private fight!: BossFight;
  private controls!: PlayerController;
  private player!: Sprite;
  private boss!: Sprite;
  private candles!: Phaser.Physics.Arcade.Group;
  private hearts!: HeartBar;
  private healthFill!: Phaser.GameObjects.Rectangle;
  private rageText!: Phaser.GameObjects.Text;
  private mode: Mode = "intro";
  private modeMs = 0;
  private attackMs = 0;
  private nextAttack: "charge" | "candles" = "charge";
  private drops: PendingDrop[] = [];
  private invulnerableUntil = 0;
  private stompableAt = 0;

  constructor() {
    super("Boss");
  }

  create(data: StageData): void {
    this.stage = { ...data };
    const world = data.paper.worlds[data.worldIndex];
    this.fight = new BossFight(world.boss.questions);
    this.mode = "intro";
    this.modeMs = INTRO_MS;
    this.nextAttack = "charge";
    this.drops = [];
    this.invulnerableUntil = 0;
    this.stompableAt = 0;

    audio.playMusic("boss");
    this.physics.world.gravity.y = GRAVITY;
    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.physics.world.setBoundsCollision(true, true, true, true);
    this.drawArena();

    const floor = this.physics.add.staticGroup();
    for (let x = 0; x < GAME_WIDTH / TILE; x++) {
      floor.create(x * TILE + TILE / 2, FLOOR_Y + TILE / 2, "ground-top");
      floor.create(x * TILE + TILE / 2, FLOOR_Y + TILE * 1.5, "ground");
    }
    const platforms = this.physics.add.staticGroup();
    for (const startCol of [2, 19]) {
      for (let col = startCol; col < startCol + 4; col++) {
        const platform = platforms.create(col * TILE + TILE / 2, 8 * TILE + 6, "platform") as StaticSprite;
        makeOneWay(platform.body);
      }
    }

    this.boss = this.physics.add.sprite(620, FLOOR_Y - 60, "boss").setScale(1.6);
    this.boss.setCollideWorldBounds(true);
    this.boss.body.setSize(56, 52).setOffset(4, 8);

    this.controls = new PlayerController(this, 120, FLOOR_Y - 30);
    this.player = this.controls.sprite.setDepth(0);

    this.candles = this.physics.add.group();
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, platforms);
    this.physics.add.collider(this.boss, floor);
    this.physics.add.collider(this.candles, floor, (candle) => (candle as Sprite).destroy());
    this.physics.add.overlap(this.player, this.boss, () => this.touchBoss());
    this.physics.add.overlap(this.player, this.candles, (_player, candle) => {
      (candle as Sprite).destroy();
      this.damage((candle as Sprite).x);
    });

    this.drawHud(world.boss.name);
    // No pausing during a question: the fight is already stopped then.
    enablePause(this, () => this.mode !== "question" && this.mode !== "over");
  }

  private drawArena(): void {
    this.cameras.main.setBackgroundColor(NES.black);
    // The boss always fights in the neon night city.
    this.add.tileSprite(0, GAME_HEIGHT - 250, GAME_WIDTH, 200, farKey(THEMES[2])).setOrigin(0, 0).setAlpha(0.6);
    this.add.rectangle(0, 0, GAME_WIDTH, 60, NES.navy, 1).setOrigin(0, 0);
  }

  private drawHud(bossName: string): void {
    this.hearts = new HeartBar(this, 16, 14);
    this.hearts.set(this.stage.lives);
    this.add.text(BAR.x, 10, bossName, textStyle(16, NES.salmon));
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.gray).setOrigin(0, 0).setStrokeStyle(2, NES.white);
    this.healthFill = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.red).setOrigin(0, 0);
    this.rageText = this.add.text(BAR.x - 16, 36, "", textStyle(8, NES.red)).setOrigin(1, 0);

    const hint = this.add
      .text(GAME_WIDTH / 2, 130, "STOMP THE BOSS TO ANSWER!\nDODGE ITS CHARGE AND THE CANDLES", textStyle(16, NES.yellow))
      .setOrigin(0.5)
      .setAlign("center");
    this.tweens.add({ targets: hint, alpha: 0, delay: INTRO_MS, duration: 600 });
  }

  update(time: number, deltaMs: number): void {
    if (this.mode === "question" || this.mode === "over") return;
    this.controls.update(time);
    this.updateDrops(deltaMs);
    this.updateBoss(deltaMs);
  }

  private get rage(): number {
    return this.fight.rage;
  }

  private updateBoss(deltaMs: number): void {
    const towardPlayer = Math.sign(this.player.x - this.boss.x) || 1;
    this.modeMs -= deltaMs;

    switch (this.mode) {
      case "intro":
        if (this.modeMs <= 0) this.startWalking();
        break;
      case "walk":
        this.boss.setVelocityX(towardPlayer * (60 + this.rage * 30));
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0) this.startAttack();
        break;
      case "telegraph":
        // Shake in place so the player can see the charge coming.
        this.boss.setVelocityX(0);
        this.boss.setX(this.boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) {
          this.mode = "charge";
          this.modeMs = 2500;
          this.boss.setVelocityX(towardPlayer * (380 + this.rage * 60));
        }
        break;
      case "charge":
        if (this.boss.body.blocked.left || this.boss.body.blocked.right || this.modeMs <= 0) {
          this.mode = "stunned";
          this.modeMs = STUN_MS;
          this.boss.setVelocityX(0).setTint(NES.lightGray);
          this.cameras.main.shake(200, 0.01);
          audio.playSfx("bump");
        }
        break;
      case "stunned":
        if (this.modeMs <= 0) this.startWalking();
        break;
    }
  }

  private startWalking(): void {
    this.mode = "walk";
    this.attackMs = Math.max(2400 - this.rage * 400, 1000);
    this.boss.clearTint();
  }

  private startAttack(): void {
    if (this.nextAttack === "charge") {
      this.mode = "telegraph";
      this.modeMs = TELEGRAPH_MS;
      this.boss.setTint(NES.red);
      this.nextAttack = "candles";
      return;
    }
    // Candle rain: the boss jumps and red candles fall where warnings flash.
    this.nextAttack = "charge";
    if (this.boss.body.blocked.down) this.boss.setVelocityY(-650);
    const count = 3 + this.rage * 2;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
      const marker = this.add.rectangle(x, FLOOR_Y - 3, 28, 6, NES.red).setAlpha(0.8);
      this.tweens.add({ targets: marker, alpha: 0.2, duration: 120, yoyo: true, repeat: -1 });
      this.drops.push({ x, remainingMs: CANDLE_WARNING_MS + i * 150, marker });
    }
    this.startWalking();
  }

  private updateDrops(deltaMs: number): void {
    for (const drop of [...this.drops]) {
      drop.remainingMs -= deltaMs;
      if (drop.remainingMs > 0) continue;
      drop.marker.destroy();
      this.drops = this.drops.filter((other) => other !== drop);
      const candle = this.candles.create(drop.x, -20, "spike") as Sprite;
      candle.setVelocityY(200).setFlipY(true);
      candle.body.setSize(20, 24).setOffset(6, 4);
    }
  }

  private touchBoss(): void {
    if (this.mode === "intro") return;
    const falling = this.player.body.velocity.y > 0;
    const fromAbove = this.player.body.bottom <= this.boss.body.top + 20;
    if (falling && fromAbove && this.time.now >= this.stompableAt) this.stomp();
    // A stunned boss is dizzy and harmless: that's the moment to jump on it.
    else if (this.mode !== "stunned") this.damage(this.boss.x);
  }

  private stomp(): void {
    audio.playSfx("stomp");
    this.controls.bounce(JUMP_VELOCITY * 0.8);
    this.boss.clearTint();
    this.cameras.main.shake(150, 0.01);
    this.mode = "question";
    this.physics.pause();
    this.time.delayedCall(250, () => this.askQuestion());
  }

  private askQuestion(): void {
    const question = this.fight.current;
    if (!question) return;
    const questionPanel = new QuestionPanel(this, question, PANEL_TOP, (choiceIndex) => {
      questionPanel.destroy();
      const correct = this.fight.answer(choiceIndex);
      this.showFeedback(correct, question.choices[question.answerIndex], question.explanation);
    });
  }

  private showFeedback(correct: boolean, answer: string, explanation: string): void {
    audio.playSfx(correct ? "correct" : "wrong");
    if (correct) {
      this.tweens.add({
        targets: this.healthFill,
        width: (BAR.width * this.fight.health) / this.fight.maxHealth,
        duration: 300,
      });
      this.flash(this.boss);
    } else {
      this.rageText.setText(`RAGE ${"!".repeat(this.rage)}`);
      this.boss.setTint(NES.salmon);
    }

    const heading = correct ? "HIT! BOSS TAKES DAMAGE" : "WRONG! THE BOSS GETS ANGRIER";
    const detail = correct ? explanation : `Answer: ${answer}\n\n${explanation}`;
    const feedback = [
      panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230),
      this.add.text(40, PANEL_TOP + 20, heading, textStyle(16, correct ? NES.lime : NES.salmon)),
      this.add.text(40, PANEL_TOP + 60, detail, textStyle(16, NES.white, GAME_WIDTH - 80)),
      this.add.text(GAME_WIDTH - 40, PANEL_TOP + 214, "SPACE / CLICK", textStyle(8, NES.yellow)).setOrigin(1, 1),
    ];
    onceAdvance(this, () => {
      feedback.forEach((object) => object.destroy());
      if (this.fight.defeated) this.win();
      else this.resumeFight();
    });
  }

  private resumeFight(): void {
    this.physics.resume();
    this.startWalking();
    this.stompableAt = this.time.now + STOMP_COOLDOWN_MS;
    this.invulnerableUntil = this.time.now + PLAYER_INVULNERABLE_MS;
  }

  private damage(fromX: number): void {
    if (this.mode === "over" || this.time.now < this.invulnerableUntil) return;
    this.invulnerableUntil = this.time.now + PLAYER_INVULNERABLE_MS;
    this.stage.lives -= 1;
    this.hearts.set(this.stage.lives);
    audio.playSfx("hurt");
    this.controls.knockback(fromX);
    this.cameras.main.shake(150, 0.01);
    this.tweens.add({ targets: this.player, alpha: 0.2, duration: 100, yoyo: true, repeat: 5 });
    if (this.stage.lives <= 0) this.lose();
  }

  private flash(target: Phaser.GameObjects.Components.Alpha): void {
    this.tweens.add({ targets: target, alpha: 0.2, duration: 80, yoyo: true, repeat: 3 });
  }

  private endFight(): void {
    this.mode = "over";
    this.physics.pause();
    this.drops.forEach((drop) => drop.marker.destroy());
    this.drops = [];
  }

  private win(): void {
    this.endFight();
    const { paper, worldIndex } = this.stage;
    const nextWorld = worldIndex + 1;
    const hasNextWorld = nextWorld < paper.worlds.length;
    audio.playSfx("clear");
    if (hasNextWorld) saveProgress({ paperId: paper.id, worldIndex: nextWorld, checkpointsCleared: 0 });
    else clearProgress();

    this.tweens.add({ targets: this.boss, alpha: 0, angle: 90, y: this.boss.y + 40, duration: 800 });
    panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230);
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 40, "WORLD CLEAR!", textStyle(32, NES.yellow)).setOrigin(0.5);
    // Only the hand-written papers have more worlds on the way; generated
    // games already cover the whole paper.
    const handWritten = LIBRARY.some((built) => built.id === paper.id);
    const message = hasNextWorld
      ? "You beat the boss. On to the next section of the paper!"
      : handWritten
        ? "You beat every world in this paper. More worlds are coming soon!"
        : "You beat every world in this paper. Scholar status: legendary!";
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 90, message, textStyle(16, NES.white, GAME_WIDTH - 100)).setOrigin(0.5);
    new Menu(this, 280, PANEL_TOP + 140, [
      ...(hasNextWorld
        ? [
            {
              label: "NEXT WORLD",
              onSelect: () =>
                this.scene.start("Level", { paper, worldIndex: nextWorld, checkpointsCleared: 0, lives: START_LIVES }),
            },
          ]
        : []),
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }

  private lose(): void {
    this.endFight();
    audio.playSfx("gameover");
    panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230);
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 50, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5);
    new Menu(this, 280, PANEL_TOP + 110, [
      { label: "RETRY BOSS", onSelect: () => this.scene.restart({ ...this.stage, lives: START_LIVES }) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
