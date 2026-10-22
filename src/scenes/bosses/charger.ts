import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { NES } from "../../palette";
import type { Sprite } from "../../player";
import { GAME_WIDTH } from "../../ui";
import { floorWarning, type BossArena, type BossBehavior } from "./arena";

// World 1's boss: walks toward the player, then takes turns between a
// charge across the arena (it shakes first) and a rain of candles (red
// marks flash where they'll land). After a charge it hits the wall and is
// dizzy for a moment, which is the time to stomp it.

type Mode = "walk" | "telegraph" | "charge" | "stunned";

const TELEGRAPH_MS = 1100; // shaking before a charge
const STUN_MS = 1600; // dizzy and harmless after hitting a wall
const CHARGE_MS = 2500;
const CANDLE_WARNING_MS = 1200; // red mark before a candle falls
const WALK_SPEED = 50;
const CHARGE_SPEED = 280;

interface PendingDrop {
  x: number;
  remainingMs: number;
  marker: Phaser.GameObjects.Rectangle;
}

export class Charger implements BossBehavior {
  readonly hint = "DODGE ITS CHARGE AND THE CANDLES";
  private mode: Mode = "walk";
  private modeMs = 0;
  private attackMs = 0;
  private nextAttack: "charge" | "candles" = "charge";
  private drops: PendingDrop[] = [];

  constructor(private readonly arena: BossArena) {
    arena.scene.physics.add.collider(arena.hazards, arena.floor, (candle) => (candle as Sprite).destroy());
  }

  get harmless(): boolean {
    return this.mode === "stunned";
  }

  resume(): void {
    this.mode = "walk";
    this.attackMs = this.arena.attackDelay();
    this.arena.boss.clearTint();
  }

  update(deltaMs: number): void {
    const { boss, player } = this.arena;
    const towardPlayer = Math.sign(player.x - boss.x) || 1;
    this.updateDrops(deltaMs);
    this.modeMs -= deltaMs;

    switch (this.mode) {
      case "walk":
        boss.setVelocityX(towardPlayer * WALK_SPEED * this.arena.speedScale());
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0) this.startAttack();
        break;
      case "telegraph":
        // Shake in place so the player can see the charge coming.
        boss.setVelocityX(0);
        boss.setX(boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) {
          this.mode = "charge";
          this.modeMs = CHARGE_MS;
          boss.setVelocityX(towardPlayer * CHARGE_SPEED * this.arena.speedScale());
        }
        break;
      case "charge":
        if (boss.body.blocked.left || boss.body.blocked.right || this.modeMs <= 0) {
          this.mode = "stunned";
          this.modeMs = STUN_MS;
          boss.setVelocityX(0).setTint(NES.lightGray);
          this.arena.scene.cameras.main.shake(200, 0.01);
          audio.playSfx("bump");
        }
        break;
      case "stunned":
        if (this.modeMs <= 0) this.resume();
        break;
    }
  }

  end(): void {
    this.drops.forEach((drop) => drop.marker.destroy());
    this.drops = [];
  }

  private startAttack(): void {
    const { boss } = this.arena;
    if (this.nextAttack === "charge") {
      this.mode = "telegraph";
      this.modeMs = TELEGRAPH_MS;
      boss.setTint(NES.red);
      this.nextAttack = "candles";
      return;
    }
    // Candle rain: the boss jumps and red candles fall where warnings flash.
    this.nextAttack = "charge";
    if (boss.body.blocked.down) boss.setVelocityY(-650);
    const count = 2 + this.arena.rage;
    for (let i = 0; i < count; i++) {
      const x = Phaser.Math.Between(40, GAME_WIDTH - 40);
      this.drops.push({ x, remainingMs: CANDLE_WARNING_MS + i * 150, marker: floorWarning(this.arena, x, 28) });
    }
    this.resume();
  }

  private updateDrops(deltaMs: number): void {
    for (const drop of [...this.drops]) {
      drop.remainingMs -= deltaMs;
      if (drop.remainingMs > 0) continue;
      drop.marker.destroy();
      this.drops = this.drops.filter((other) => other !== drop);
      const candle = this.arena.hazards.create(drop.x, -20, "spike") as Sprite;
      candle.setVelocityY(200).setFlipY(true);
      candle.body.setSize(20, 24).setOffset(6, 4);
    }
  }
}
