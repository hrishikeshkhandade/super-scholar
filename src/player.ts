import Phaser from "phaser";
import { audio } from "./audio/audio";

// WASD movement and jumping, shared by the levels and the boss arena so the
// controls feel the same everywhere.

export type Sprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

export const GRAVITY = 1400;
export const JUMP_VELOCITY = -600;
const RUN_SPEED = 210;
const COYOTE_MS = 100; // can still jump just after running off a ledge
const JUMP_BUFFER_MS = 120; // a jump pressed just before landing still counts
const KNOCKBACK_SPEED = 260;
const KNOCKBACK_MS = 250;

type KeyName = "left" | "right" | "jump" | "down";

export class PlayerController {
  readonly sprite: Sprite;
  private readonly keys: Record<KeyName, Phaser.Input.Keyboard.Key[]>;
  private lastGroundedAt = 0;
  private jumpPressedAt = -Infinity;
  private jumping = false; // true during a jump the player started (not a bounce)
  private knockbackUntil = 0;

  constructor(
    private readonly scene: Phaser.Scene,
    x: number,
    y: number,
    onDrop: () => void = () => {},
  ) {
    this.sprite = scene.physics.add.sprite(x, y, "player-idle");
    this.sprite.setCollideWorldBounds(true).setDepth(5);
    this.sprite.body.setSize(20, 36).setOffset(6, 4);

    const keyboard = scene.input.keyboard!;
    // Capture is off so these keys still type normally in the search box.
    const add = (...codes: number[]) => codes.map((code) => keyboard.addKey(code, false));
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      jump: add(K.W, K.UP, K.SPACE),
      down: add(K.S, K.DOWN),
    };
    for (const key of this.keys.jump) key.on("down", () => (this.jumpPressedAt = scene.time.now));
    for (const key of this.keys.down) key.on("down", onDrop);
  }

  update(time: number): void {
    const body = this.sprite.body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.lastGroundedAt = time;

    const direction = (this.isDown("right") ? 1 : 0) - (this.isDown("left") ? 1 : 0);
    // While knocked back, the push wins over the keys for a moment.
    if (time >= this.knockbackUntil) {
      this.sprite.setVelocityX(direction * RUN_SPEED);
      if (direction !== 0) this.sprite.setFlipX(direction < 0);
    }

    const canJump = time - this.lastGroundedAt <= COYOTE_MS;
    if (canJump && time - this.jumpPressedAt <= JUMP_BUFFER_MS) {
      this.sprite.setVelocityY(JUMP_VELOCITY);
      this.jumping = true;
      audio.playSfx("jump");
      this.jumpPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
    }
    // Let go of jump early for a short hop.
    if (body.velocity.y >= 0) this.jumping = false;
    if (this.jumping && !this.isDown("jump") && body.velocity.y < JUMP_VELOCITY / 3) {
      this.sprite.setVelocityY(JUMP_VELOCITY / 3);
      this.jumping = false;
    }

    if (!onGround) this.showFrame("player-jump");
    else if (direction !== 0) this.sprite.anims.play("player-walk", true);
    else this.showFrame("player-idle");
  }

  // Launch upward without the short-hop cut, e.g. off a stomped enemy.
  bounce(velocityY: number): void {
    this.jumping = false;
    this.sprite.setVelocityY(velocityY);
  }

  // Pushed up and away from whatever hit the player at fromX.
  knockback(fromX: number): void {
    const away = Math.sign(this.sprite.x - fromX) || 1;
    this.bounce(JUMP_VELOCITY * 0.6);
    this.sprite.setVelocityX(away * KNOCKBACK_SPEED);
    this.knockbackUntil = this.scene.time.now + KNOCKBACK_MS;
  }

  showFrame(texture: string): void {
    this.sprite.anims.stop();
    this.sprite.setTexture(texture);
  }

  private isDown(name: KeyName): boolean {
    return this.keys[name].some((key) => key.isDown);
  }
}

// Platforms you can jump up through and land on from above.
export function makeOneWay(body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): void {
  body.checkCollision.down = false;
  body.checkCollision.left = false;
  body.checkCollision.right = false;
}
