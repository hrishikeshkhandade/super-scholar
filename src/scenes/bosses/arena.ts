import type Phaser from "phaser";
import { NES } from "../../palette";
import type { Sprite } from "../../player";

// What a boss style can see and use. The boss scene owns everything shared
// by every fight (questions, hearts, stomping, winning and losing); a style
// only decides how the boss moves and attacks.
export interface BossArena {
  readonly scene: Phaser.Scene;
  readonly boss: Sprite;
  readonly player: Sprite;
  readonly floor: Phaser.Physics.Arcade.StaticGroup;
  readonly floorY: number; // the top of the floor
  // Touching anything in this group hurts the player and removes it.
  readonly hazards: Phaser.Physics.Arcade.Group;
  readonly rage: number;
  // Difficulty and rage together: multiply speeds by this.
  speedScale(): number;
  // How long to wait between attacks, in ms (sooner on HARD and when angry).
  attackDelay(): number;
  // Costs the player a heart (if they're not still recovering from a hit).
  hurtPlayer(fromX: number): void;
  // Bounces the player up, as after stomping something.
  bouncePlayer(): void;
}

export interface BossBehavior {
  // The second line of the intro hint, e.g. "DODGE ITS CHARGE AND THE CANDLES".
  readonly hint: string;
  // True while the boss is dizzy: touching it doesn't hurt.
  readonly harmless: boolean;
  // When the fight starts and after every question.
  resume(): void;
  update(deltaMs: number): void;
  // When the fight ends: clear warnings still on screen.
  end(): void;
}

// A flashing red mark on the floor where something is about to land.
export function floorWarning(arena: BossArena, x: number, width: number): Phaser.GameObjects.Rectangle {
  const marker = arena.scene.add.rectangle(x, arena.floorY - 3, width, 6, NES.red).setAlpha(0.8);
  arena.scene.tweens.add({ targets: marker, alpha: 0.2, duration: 120, yoyo: true, repeat: -1 });
  return marker;
}
