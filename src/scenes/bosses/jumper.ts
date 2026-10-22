import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { NES } from "../../palette";
import { GRAVITY, type Sprite } from "../../player";
import { GAME_WIDTH } from "../../ui";
import { floorWarning, type BossArena, type BossBehavior } from "./arena";

// World 2's boss: crouches and shakes, then leaps at the player. A red mark
// flashes where it will land. Landing shakes the arena and sends a
// shockwave along the floor both ways, to jump over. Then it's dizzy for a
// moment, which is the time to stomp it.

type Mode = "walk" | "crouch" | "leap" | "dizzy";

const WALK_SPEED = 40;
const CROUCH_MS = 900;
const LEAP_VELOCITY = -760;
const MAX_LEAP_SPEED = 420; // sideways, so it can't cross the whole arena at once
const DIZZY_MS = 1500;
const WAVE_SPEED = 220;
const LANDING_MARK_WIDTH = 72;

export class Jumper implements BossBehavior {
  readonly hint = "JUMP OVER THE SHOCKWAVES";
  private mode: Mode = "walk";
  private modeMs = 0;
  private attackMs = 0;
  private leftGround = false;
  private landingMark?: Phaser.GameObjects.Rectangle;

  constructor(private readonly arena: BossArena) {}

  get harmless(): boolean {
    return this.mode === "dizzy";
  }

  resume(): void {
    this.end(); // a stomp mid-leap cancels the landing
    this.mode = "walk";
    this.attackMs = this.arena.attackDelay();
    this.arena.boss.clearTint();
  }

  update(deltaMs: number): void {
    const { boss, player } = this.arena;
    this.removeOffscreenWaves();
    this.modeMs -= deltaMs;

    switch (this.mode) {
      case "walk":
        boss.setVelocityX((Math.sign(player.x - boss.x) || 1) * WALK_SPEED * this.arena.speedScale());
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0 && boss.body.blocked.down) {
          this.mode = "crouch";
          this.modeMs = CROUCH_MS;
          boss.setVelocityX(0).setTint(NES.red);
        }
        break;
      case "crouch":
        boss.setX(boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) this.leap();
        break;
      case "leap":
        if (!boss.body.blocked.down) this.leftGround = true;
        else if (this.leftGround) this.land();
        break;
      case "dizzy":
        if (this.modeMs <= 0) this.resume();
        break;
    }
  }

  end(): void {
    this.landingMark?.destroy();
    this.landingMark = undefined;
  }

  // Aim for where the player is now: the time in the air is fixed by the
  // jump, so the sideways speed decides where it lands.
  private leap(): void {
    const { boss, player } = this.arena;
    const airTime = (2 * -LEAP_VELOCITY) / GRAVITY;
    const speed = Phaser.Math.Clamp((player.x - boss.x) / airTime, -MAX_LEAP_SPEED, MAX_LEAP_SPEED);
    const landingX = Phaser.Math.Clamp(boss.x + speed * airTime, 40, GAME_WIDTH - 40);
    this.landingMark = floorWarning(this.arena, landingX, LANDING_MARK_WIDTH);
    this.mode = "leap";
    this.leftGround = false;
    boss.setVelocity(speed, LEAP_VELOCITY);
  }

  private land(): void {
    const { boss, scene } = this.arena;
    this.end();
    this.mode = "dizzy";
    this.modeMs = DIZZY_MS;
    boss.setVelocityX(0).setTint(NES.lightGray);
    scene.cameras.main.shake(250, 0.015);
    audio.playSfx("bump");
    for (const direction of [-1, 1]) {
      const wave = this.arena.hazards.create(boss.x + direction * 40, this.arena.floorY - 12, "shockwave") as Sprite;
      wave.body.setAllowGravity(false);
      wave.setVelocityX(direction * WAVE_SPEED * this.arena.speedScale()).setFlipX(direction < 0);
    }
  }

  private removeOffscreenWaves(): void {
    for (const wave of this.arena.hazards.getChildren() as Sprite[]) {
      if (wave.x < -40 || wave.x > GAME_WIDTH + 40) wave.destroy();
    }
  }
}
