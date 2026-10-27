import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { burst } from "../../effects";
import { NES } from "../../palette";
import { GRAVITY } from "../../jump";
import type { Sprite } from "../../player";
import { GAME_WIDTH } from "../../ui";
import { floorWarning, type BossArena, type BossBehavior } from "./arena";

// World 3's boss: keeps its distance, backing away when the player gets
// close, and throws arcing books. It shakes before each throw, and red marks
// flash where the books will land. After a throw it stops to reload, dizzy
// for a moment, which is the time to stomp it.

type Mode = "keepAway" | "windUp" | "reload";

const RETREAT_SPEED = 60;
const COMFORT_DISTANCE = 260; // backs away when the player is closer than this
const WIND_UP_MS = 800;
const RELOAD_MS = 1700;
const FLIGHT_MS = 1100; // how long a book is in the air
const BOOK_SPREAD = 70; // books land this far apart, around the player
const EDGE_MARGIN = 60;

interface Throw {
  book: Sprite;
  marker: Phaser.GameObjects.Rectangle;
}

export class Thrower implements BossBehavior {
  readonly hint = "DODGE THE FLYING BOOKS";
  private mode: Mode = "keepAway";
  private modeMs = 0;
  private attackMs = 0;
  private throws: Throw[] = [];

  constructor(private readonly arena: BossArena) {
    arena.scene.physics.add.collider(arena.hazards, arena.floor, (book) => this.land(book as Sprite));
  }

  get harmless(): boolean {
    return this.mode === "reload";
  }

  resume(): void {
    this.mode = "keepAway";
    this.attackMs = this.arena.attackDelay();
    this.arena.boss.clearTint();
  }

  update(deltaMs: number): void {
    const { boss, player } = this.arena;
    this.modeMs -= deltaMs;
    // A book that was dodged (or hit the player) no longer needs its mark.
    for (const flight of [...this.throws]) if (!flight.book.active) this.clearThrow(flight);

    switch (this.mode) {
      case "keepAway": {
        const away = Math.sign(boss.x - player.x) || 1;
        const tooClose = Math.abs(boss.x - player.x) < COMFORT_DISTANCE;
        const roomBehind = away > 0 ? boss.x < GAME_WIDTH - EDGE_MARGIN : boss.x > EDGE_MARGIN;
        boss.setVelocityX(tooClose && roomBehind ? away * RETREAT_SPEED * this.arena.speedScale() : 0);
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0) {
          this.mode = "windUp";
          this.modeMs = WIND_UP_MS;
          boss.setVelocityX(0).setTint(NES.red);
        }
        break;
      }
      case "windUp":
        boss.setX(boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) this.throwBooks();
        break;
      case "reload":
        if (this.modeMs <= 0) this.resume();
        break;
    }
  }

  end(): void {
    [...this.throws].forEach((flight) => this.clearThrow(flight));
  }

  // Each book is aimed to land at a spot around the player after a fixed
  // time in the air, so its arc can be worked out from where it starts.
  private throwBooks(): void {
    const { boss, player, scene } = this.arena;
    const count = 2 + Math.min(this.arena.rage, 1);
    const flightSeconds = FLIGHT_MS / 1000 / this.arena.speedScale();
    const startY = boss.y - 40;
    const landY = this.arena.floorY - 12;
    for (let i = 0; i < count; i++) {
      const offset = (i - (count - 1) / 2) * BOOK_SPREAD;
      const targetX = Phaser.Math.Clamp(player.x + offset, 30, GAME_WIDTH - 30);
      const book = this.arena.hazards.create(boss.x, startY, "book") as Sprite;
      book.body.setSize(24, 20);
      book.setVelocity(
        (targetX - boss.x) / flightSeconds,
        (landY - startY - 0.5 * GRAVITY * flightSeconds ** 2) / flightSeconds,
      );
      scene.tweens.add({ targets: book, angle: 360, duration: 500, repeat: -1 });
      this.throws.push({ book, marker: floorWarning(this.arena, targetX, 32) });
    }
    audio.playSfx("jump");
    this.mode = "reload";
    this.modeMs = RELOAD_MS;
    boss.setTint(NES.lightGray);
  }

  private land(book: Sprite): void {
    burst(this.arena.scene, book.x, book.y, [NES.brown, NES.white], { count: 10, speed: 120 });
    book.destroy();
  }

  private clearThrow(flight: Throw): void {
    flight.marker.destroy();
    this.throws = this.throws.filter((other) => other !== flight);
  }
}
