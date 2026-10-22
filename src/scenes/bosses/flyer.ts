import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { NES } from "../../palette";
import { GAME_WIDTH } from "../../ui";
import { floorWarning, type BossArena, type BossBehavior } from "./arena";

// World 5's boss: hovers out of reach, drifting to follow the player. It
// shakes before each attack while a red mark shows where it will dive, then
// swoops down onto that spot and crashes into the floor, dizzy for a moment:
// the only time it can be stomped. Then it flies back up.

type Mode = "hover" | "windUp" | "dive" | "landed" | "rise";

const HOVER_Y = 150;
const HOVER_SPEED = 90;
const HOVER_BOB = { height: 6, msPerBob: 700 };
const WIND_UP_MS = 900;
const DIVE_SPEED = 360;
const LANDED_MS = 2000;
const RISE_SPEED = 220;
const EDGE_MARGIN = 60;
const WING_OFFSET = { x: 56, y: -26 };
const FLAP_MS = 90;

export class Flyer implements BossBehavior {
  readonly hint = "STOMP IT WHEN IT CRASHES DOWN";
  private mode: Mode = "rise";
  private modeMs = 0;
  private attackMs = 0;
  private flightMs = 0;
  private target = { x: 0, y: 0 };
  private landingMark?: Phaser.GameObjects.Rectangle;
  private readonly wings: Phaser.GameObjects.Image[];

  constructor(private readonly arena: BossArena) {
    this.wings = [-1, 1].map((side) => arena.scene.add.image(0, 0, "wing").setFlipX(side < 0).setData("side", side));
    this.updateWings();
  }

  get harmless(): boolean {
    return this.mode === "landed";
  }

  resume(): void {
    this.clearLandingMark();
    this.arena.boss.clearTint();
    this.arena.boss.body.setAllowGravity(false);
    this.attackMs = this.arena.attackDelay();
    // From the floor (or partway down) it first flies back up.
    this.mode = this.arena.boss.y > HOVER_Y + 10 ? "rise" : "hover";
  }

  update(deltaMs: number): void {
    const { boss, player } = this.arena;
    this.modeMs -= deltaMs;
    this.flightMs += deltaMs;
    this.updateWings();

    switch (this.mode) {
      case "rise":
        boss.setVelocity(0, -RISE_SPEED * this.arena.speedScale());
        if (boss.y <= HOVER_Y) this.mode = "hover";
        break;
      case "hover": {
        const targetX = Phaser.Math.Clamp(player.x, EDGE_MARGIN, GAME_WIDTH - EDGE_MARGIN);
        const towardX = Math.abs(targetX - boss.x) > 8 ? Math.sign(targetX - boss.x) : 0;
        const bob = Math.sin((this.flightMs / HOVER_BOB.msPerBob) * Math.PI * 2) * HOVER_BOB.height;
        boss.setVelocity(towardX * HOVER_SPEED * this.arena.speedScale(), (HOVER_Y + bob - boss.y) * 4);
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0) this.windUp();
        break;
      }
      case "windUp":
        boss.setVelocity(0, 0);
        boss.setX(boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) this.dive();
        break;
      case "dive":
        if (boss.body.blocked.down) this.land();
        break;
      case "landed":
        if (this.modeMs <= 0) this.resume();
        break;
    }
  }

  // The fight is over: the wings go with the boss.
  end(): void {
    this.clearLandingMark();
    this.arena.scene.tweens.add({ targets: this.wings, alpha: 0, duration: 300 });
  }

  private clearLandingMark(): void {
    this.landingMark?.destroy();
    this.landingMark = undefined;
  }

  private windUp(): void {
    const { boss, player } = this.arena;
    this.mode = "windUp";
    this.modeMs = WIND_UP_MS;
    boss.setTint(NES.red);
    this.target.x = Phaser.Math.Clamp(player.x, EDGE_MARGIN, GAME_WIDTH - EDGE_MARGIN);
    this.landingMark = floorWarning(this.arena, this.target.x, 80);
  }

  // A straight swoop from where it hovers to the marked spot on the floor.
  private dive(): void {
    const { boss } = this.arena;
    this.mode = "dive";
    const dx = this.target.x - boss.x;
    const dy = this.arena.floorY - boss.y;
    const speed = DIVE_SPEED * this.arena.speedScale();
    const length = Math.hypot(dx, dy);
    boss.setVelocity((dx / length) * speed, (dy / length) * speed);
  }

  private land(): void {
    const { boss, scene } = this.arena;
    this.clearLandingMark();
    this.mode = "landed";
    this.modeMs = LANDED_MS;
    boss.setVelocity(0, 0).setTint(NES.lightGray);
    boss.body.setAllowGravity(true);
    scene.cameras.main.shake(250, 0.015);
    audio.playSfx("bump");
  }

  // Wings flap while flying and fold down on the floor.
  private updateWings(): void {
    const { boss } = this.arena;
    const flying = this.mode !== "landed";
    const flap = flying ? 1 + Math.sin((this.flightMs / FLAP_MS) * Math.PI) * 0.35 : 0.5;
    for (const wing of this.wings) {
      const side = wing.getData("side") as number;
      wing.setPosition(boss.x + side * WING_OFFSET.x, boss.y + WING_OFFSET.y).setScale(1, flap);
    }
  }
}
