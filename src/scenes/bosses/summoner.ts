import Phaser from "phaser";
import { audio } from "../../audio/audio";
import { burst } from "../../effects";
import { NES } from "../../palette";
import type { Sprite } from "../../player";
import { GAME_WIDTH } from "../../ui";
import { floorWarning, type BossArena, type BossBehavior } from "./arena";

// World 4's boss: walks toward the player, then shakes and calls bears down
// from the sky (red marks flash where they'll land). The bears walk at the
// player, and can be stomped like in the levels. Summoning tires the boss
// out, so it's dizzy for a moment afterwards, which is the time to stomp it.

type Mode = "walk" | "summon" | "tired";

const WALK_SPEED = 35;
const SUMMON_MS = 900; // shaking, with the landing marks flashing
const TIRED_MS = 1800;
const MINION_SPEED = 70;
const MAX_MINIONS = 3; // so the arena never gets crowded
const SPAWN_DISTANCE = 220; // minions land this far to each side of the player
const EDGE_MARGIN = 40;
const CLEAR_OF_BOSS = 100; // so a bear doesn't land on top of the boss

export class Summoner implements BossBehavior {
  readonly hint = "STOMP OR DODGE ITS BEARS";
  private mode: Mode = "walk";
  private modeMs = 0;
  private attackMs = 0;
  private readonly minions: Phaser.Physics.Arcade.Group;
  private markers: Phaser.GameObjects.Rectangle[] = [];

  constructor(private readonly arena: BossArena) {
    const { scene, floor, player } = arena;
    this.minions = scene.physics.add.group();
    scene.physics.add.collider(this.minions, floor);
    scene.physics.add.overlap(player, this.minions, (_player, minion) => this.touchMinion(minion as Sprite));
  }

  get harmless(): boolean {
    return this.mode === "tired";
  }

  resume(): void {
    this.mode = "walk";
    this.attackMs = this.arena.attackDelay();
    this.arena.boss.clearTint();
  }

  update(deltaMs: number): void {
    const { boss, player } = this.arena;
    this.updateMinions();
    this.modeMs -= deltaMs;

    switch (this.mode) {
      case "walk":
        boss.setVelocityX((Math.sign(player.x - boss.x) || 1) * WALK_SPEED * this.arena.speedScale());
        this.attackMs -= deltaMs;
        if (this.attackMs <= 0) this.startSummon();
        break;
      case "summon":
        boss.setX(boss.x + (Math.random() - 0.5) * 4);
        if (this.modeMs <= 0) this.dropMinions();
        break;
      case "tired":
        if (this.modeMs <= 0) this.resume();
        break;
    }
  }

  end(): void {
    this.markers.forEach((marker) => marker.destroy());
    this.markers = [];
  }

  // Bears land to each side of the player (one more when angry), never on
  // top of them or the boss, and only inside the arena.
  private startSummon(): void {
    const { boss, player } = this.arena;
    const room = MAX_MINIONS - this.minions.countActive();
    const wanted = Math.min(room, 2 + Math.min(this.arena.rage, 1));
    const spots = [-1, 1, -2, 2]
      .map((step) => player.x + step * SPAWN_DISTANCE)
      .filter((x) => x >= EDGE_MARGIN && x <= GAME_WIDTH - EDGE_MARGIN && Math.abs(x - boss.x) > CLEAR_OF_BOSS)
      .slice(0, Math.max(wanted, 0));
    if (spots.length === 0) {
      this.resume();
      return;
    }
    this.mode = "summon";
    this.modeMs = SUMMON_MS;
    boss.setVelocityX(0).setTint(NES.red);
    this.markers = spots.map((x) => floorWarning(this.arena, x, 40));
  }

  private dropMinions(): void {
    for (const marker of this.markers) {
      const minion = this.minions.create(marker.x, -30, "bear-walk1") as Sprite;
      minion.body.setSize(32, 28).setOffset(4, 4);
      minion.setData("marker", marker);
    }
    this.markers = [];
    audio.playSfx("powerup");
    this.mode = "tired";
    this.modeMs = TIRED_MS;
    this.arena.boss.setTint(NES.lightGray);
  }

  private updateMinions(): void {
    const { player } = this.arena;
    for (const minion of this.minions.getChildren() as Sprite[]) {
      if (!minion.body.enable) continue;
      if (!minion.body.blocked.down) continue;
      // Landed: its warning mark goes, and it starts walking at the player.
      (minion.getData("marker") as Phaser.GameObjects.Rectangle | undefined)?.destroy();
      minion.setData("marker", undefined);
      if (!minion.anims.isPlaying) minion.play("bear-walk");
      const direction = Math.sign(player.x - minion.x) || 1;
      minion.setVelocityX(direction * MINION_SPEED * this.arena.speedScale()).setFlipX(direction > 0);
    }
  }

  private touchMinion(minion: Sprite): void {
    if (!minion.body.enable) return;
    const { player } = this.arena;
    const stomped = player.body.velocity.y > 0 && player.body.bottom <= minion.body.top + 16;
    if (!stomped) {
      this.arena.hurtPlayer(minion.x);
      return;
    }
    minion.body.enable = false;
    audio.playSfx("stomp");
    burst(this.arena.scene, minion.x, minion.y, [NES.brown, NES.tan, NES.white]);
    minion.anims.stop();
    minion.setTexture("bear-flat").setY(minion.y + 8);
    this.arena.scene.tweens.add({ targets: minion, alpha: 0, delay: 300, duration: 250, onComplete: () => minion.destroy() });
    this.arena.bouncePlayer();
  }
}
