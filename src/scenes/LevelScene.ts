import Phaser from "phaser";
import { LEVEL_LAYOUTS } from "../levels/layouts";
import { TILE, isSolidTile, parseLevel, type BlockContents } from "../levels/parseLevel";
import { NES } from "../palette";
import { saveProgress } from "../save";
import type { StageData } from "../stage";
import { GAME_HEIGHT, GAME_WIDTH, HeartBar, MAX_LIVES, Menu, START_LIVES, panel, textStyle } from "../ui";

type Sprite = Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
type StaticSprite = Phaser.Types.Physics.Arcade.SpriteWithStaticBody;

const RUN_SPEED = 210;
const JUMP_VELOCITY = -600;
const GRAVITY = 1400;
const BEAR_SPEED = 60;
const MOVING_PLATFORM_SPEED = 70;
const MOVING_PLATFORM_RANGE = TILE * 3;
const COYOTE_MS = 100; // can still jump just after running off a ledge
const JUMP_BUFFER_MS = 120; // a jump pressed just before landing still counts
const INVULNERABLE_MS = 1200;
const FACT_SHOWN_MS = 5000;
const FACT_INDEX_KEY = "factIndex";

export class LevelScene extends Phaser.Scene {
  private stage!: StageData;
  private rows: string[] = [];
  private player!: Sprite;
  private keys!: Record<"left" | "right" | "jump" | "down", Phaser.Input.Keyboard.Key[]>;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private blocks!: Phaser.Physics.Arcade.StaticGroup;
  private platformCollider!: Phaser.Physics.Arcade.Collider;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private bears!: Phaser.Physics.Arcade.Group;
  private skyline!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private hearts!: HeartBar;
  private coinText!: Phaser.GameObjects.Text;
  private shieldIcon!: Phaser.GameObjects.Image;
  private factBanner!: Phaser.GameObjects.Container;
  private factText!: Phaser.GameObjects.Text;
  private factHideTimer?: Phaser.Time.TimerEvent;
  private coins = 0;
  private hasShield = false;
  private invulnerableUntil = 0;
  private lastGroundedAt = 0;
  private jumpPressedAt = -Infinity;
  private finished = false;
  private jumping = false; // true during a jump the player started (not a bounce)

  constructor() {
    super("Level");
  }

  create(data: StageData): void {
    this.stage = { ...data };
    this.coins = 0;
    this.hasShield = false;
    this.invulnerableUntil = 0;
    this.lastGroundedAt = 0;
    this.jumpPressedAt = -Infinity;
    this.finished = false;
    this.jumping = false;

    const layout = LEVEL_LAYOUTS[this.stage.checkpointsCleared % LEVEL_LAYOUTS.length];
    this.rows = layout.rows;
    const level = parseLevel(layout.rows);
    const worldWidth = level.widthTiles * TILE;
    const worldHeight = level.heightTiles * TILE;
    const center = (pos: { x: number; y: number }) => ({ x: pos.x * TILE + TILE / 2, y: pos.y * TILE + TILE / 2 });

    this.physics.world.gravity.y = GRAVITY;
    // No floor at the bottom of the world, so the player can fall into pits.
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight + TILE * 4);
    this.physics.world.setBoundsCollision(true, true, false, false);

    this.drawBackground();

    this.solids = this.physics.add.staticGroup();
    for (const tile of level.ground) this.solids.create(center(tile).x, center(tile).y, tile.top ? "ground-top" : "ground");
    for (const tile of level.bricks) this.solids.create(center(tile).x, center(tile).y, "brick");

    this.blocks = this.physics.add.staticGroup();
    for (const block of level.blocks) {
      const sprite = this.blocks.create(center(block).x, center(block).y, "question-block") as StaticSprite;
      sprite.setData("contents", block.contents);
    }

    const platforms = this.physics.add.staticGroup();
    for (const tile of level.platforms) {
      const platform = platforms.create(center(tile).x, tile.y * TILE + 6, "platform") as StaticSprite;
      this.makeOneWay(platform.body);
    }

    this.movingPlatforms = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const tile of level.movingPlatforms) {
      const platform = this.movingPlatforms.create(tile.x * TILE + 48, tile.y * TILE + 6, "moving-platform") as Sprite;
      this.makeOneWay(platform.body);
      platform.setData("minX", platform.x);
      platform.setVelocityX(MOVING_PLATFORM_SPEED);
    }

    const spikes = this.physics.add.staticGroup();
    for (const tile of level.spikes) {
      const spike = spikes.create(center(tile).x, center(tile).y, "spike") as StaticSprite;
      spike.body.setSize(20, 18).setOffset(6, 14);
    }

    const coins = this.physics.add.staticGroup();
    for (const tile of level.coins) {
      (coins.create(center(tile).x, center(tile).y, "coin1") as StaticSprite).play("coin-spin");
    }

    this.bears = this.physics.add.group();
    for (const tile of level.bears) {
      const bear = this.bears.create(center(tile).x, center(tile).y, "bear-walk1") as Sprite;
      bear.play("bear-walk").setVelocityX(-BEAR_SPEED);
      bear.body.setSize(32, 28).setOffset(4, 4);
    }

    const goal = this.physics.add.staticImage(center(level.goal).x, (level.goal.y + 1) * TILE - 80, "flagpole");
    goal.body.setSize(16, 160);

    this.player = this.physics.add.sprite(center(level.start).x, center(level.start).y, "player-idle");
    this.player.setCollideWorldBounds(true).setDepth(5);
    this.player.body.setSize(20, 36).setOffset(6, 4);

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.blocks, (_player, block) => this.bumpBlock(block as StaticSprite));
    this.platformCollider = this.physics.add.collider(this.player, platforms);
    this.physics.add.collider(this.player, this.movingPlatforms);
    this.physics.add.collider(this.bears, this.solids);
    this.physics.add.collider(this.bears, this.blocks);
    this.physics.add.overlap(this.player, coins, (_player, coin) => this.collectCoin(coin as StaticSprite));
    this.physics.add.overlap(this.player, spikes, () => this.damage());
    this.physics.add.overlap(this.player, this.bears, (_player, bear) => this.touchBear(bear as Sprite));
    this.physics.add.overlap(this.player, goal, () => this.reachGoal());

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.cameras.main.startFollow(this.player, true, 0.15, 0.15);
    this.cameras.main.setDeadzone(120, 80);

    this.drawHud(layout.name);
    this.createFactBanner();
    this.setUpKeys();
  }

  private makeOneWay(body: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody): void {
    body.checkCollision.down = false;
    body.checkCollision.left = false;
    body.checkCollision.right = false;
  }

  private setUpKeys(): void {
    const keyboard = this.input.keyboard!;
    // Capture is off so these keys still type normally in the search box.
    const add = (...codes: number[]) => codes.map((code) => keyboard.addKey(code, false));
    const K = Phaser.Input.Keyboard.KeyCodes;
    this.keys = {
      left: add(K.A, K.LEFT),
      right: add(K.D, K.RIGHT),
      jump: add(K.W, K.UP, K.SPACE),
      down: add(K.S, K.DOWN),
    };
    for (const key of this.keys.jump) key.on("down", () => (this.jumpPressedAt = this.time.now));
    for (const key of this.keys.down) key.on("down", () => this.dropThroughPlatform());
  }

  private isDown(keys: Phaser.Input.Keyboard.Key[]): boolean {
    return keys.some((key) => key.isDown);
  }

  private drawBackground(): void {
    this.cameras.main.setBackgroundColor(NES.sky);
    this.skyline = this.add.tileSprite(0, GAME_HEIGHT - 260, GAME_WIDTH, 200, "skyline").setOrigin(0, 0).setScrollFactor(0);
    this.hills = this.add.tileSprite(0, GAME_HEIGHT - 150, GAME_WIDTH, 128, "hills").setOrigin(0, 0).setScrollFactor(0);
    for (let i = 0; i < 6; i++) {
      this.add.image(80 + i * 260, 50 + (i % 3) * 30, "cloud").setScrollFactor(0.1);
    }
  }

  private drawHud(levelName: string): void {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor>(object: T) => object.setScrollFactor(0);
    fixed(this.add.rectangle(0, 0, GAME_WIDTH, 48, NES.black, 0.6).setOrigin(0, 0).setDepth(9));
    this.hearts = new HeartBar(this, 16, 14);
    this.hearts.set(this.stage.lives);
    this.shieldIcon = fixed(this.add.image(196, 24, "shield").setDepth(10).setVisible(false));
    fixed(this.add.image(240, 24, "coin1").setDepth(10));
    this.coinText = fixed(this.add.text(256, 18, "x 0", textStyle(12, NES.white)).setDepth(10));
    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const label = `${this.stage.worldIndex + 1}-${this.stage.checkpointsCleared + 1} ${levelName.toUpperCase()}`;
    fixed(this.add.text(GAME_WIDTH - 16, 10, label, textStyle(12, NES.yellow)).setOrigin(1, 0).setDepth(10));
    fixed(this.add.text(GAME_WIDTH - 16, 30, world.name.toUpperCase(), textStyle(8, NES.lightGray)).setOrigin(1, 0).setDepth(10));
    const hint = fixed(
      this.add.text(GAME_WIDTH / 2, 70, "A / D MOVE   W JUMP   S DROP", textStyle(12, NES.white)).setOrigin(0.5).setDepth(10),
    );
    this.tweens.add({ targets: hint, alpha: 0, delay: 4000, duration: 800 });
  }

  update(time: number): void {
    if (this.finished) return;
    this.updatePlayer(time);
    this.updateBears();
    this.updateMovingPlatforms();
    this.skyline.tilePositionX = this.cameras.main.scrollX * 0.2;
    this.hills.tilePositionX = this.cameras.main.scrollX * 0.4;
    if (this.player.y > this.rows.length * TILE + TILE) this.fallIntoPit();
  }

  private updatePlayer(time: number): void {
    const body = this.player.body;
    const onGround = body.blocked.down || body.touching.down;
    if (onGround) this.lastGroundedAt = time;

    const direction = (this.isDown(this.keys.right) ? 1 : 0) - (this.isDown(this.keys.left) ? 1 : 0);
    this.player.setVelocityX(direction * RUN_SPEED);
    if (direction !== 0) this.player.setFlipX(direction < 0);

    const canJump = time - this.lastGroundedAt <= COYOTE_MS;
    if (canJump && time - this.jumpPressedAt <= JUMP_BUFFER_MS) {
      this.player.setVelocityY(JUMP_VELOCITY);
      this.jumping = true;
      this.jumpPressedAt = -Infinity;
      this.lastGroundedAt = -Infinity;
    }
    // Let go of jump early for a short hop.
    if (body.velocity.y >= 0) this.jumping = false;
    if (this.jumping && !this.isDown(this.keys.jump) && body.velocity.y < JUMP_VELOCITY / 3) {
      this.player.setVelocityY(JUMP_VELOCITY / 3);
      this.jumping = false;
    }

    if (!onGround) this.showPlayerFrame("player-jump");
    else if (direction !== 0) this.player.anims.play("player-walk", true);
    else this.showPlayerFrame("player-idle");
  }

  private showPlayerFrame(texture: string): void {
    this.player.anims.stop();
    this.player.setTexture(texture);
  }

  private updateBears(): void {
    for (const object of this.bears.getChildren()) {
      const bear = object as Sprite;
      if (!bear.body.enable) continue;
      const body = bear.body;
      let direction = Math.sign(body.velocity.x) || -1;
      if (body.blocked.left) direction = 1;
      if (body.blocked.right) direction = -1;
      // Turn around at the edge of a ledge instead of walking off.
      const aheadX = Math.floor((bear.x + direction * 20) / TILE);
      const belowY = Math.floor((body.bottom + 4) / TILE);
      if (body.blocked.down && !isSolidTile(this.rows, aheadX, belowY)) direction = -direction;
      bear.setVelocityX(direction * BEAR_SPEED).setFlipX(direction > 0);
    }
  }

  private updateMovingPlatforms(): void {
    for (const object of this.movingPlatforms.getChildren()) {
      const platform = object as Sprite;
      const minX = platform.getData("minX") as number;
      if (platform.x >= minX + MOVING_PLATFORM_RANGE) platform.setVelocityX(-MOVING_PLATFORM_SPEED);
      if (platform.x <= minX) platform.setVelocityX(MOVING_PLATFORM_SPEED);
    }
  }

  private dropThroughPlatform(): void {
    this.platformCollider.active = false;
    this.time.delayedCall(250, () => (this.platformCollider.active = true));
  }

  private bumpBlock(block: StaticSprite): void {
    // Only a hit from below opens a block.
    if (!this.player.body.blocked.up || block.getData("used")) return;
    if (this.player.body.top < block.body.bottom - 4) return;
    block.setData("used", true).setTexture("used-block");
    this.tweens.add({ targets: block, y: block.y - 8, duration: 80, yoyo: true });
    const contents = block.getData("contents") as BlockContents;
    if (contents === "coin") {
      this.addCoins(1);
      const coin = this.add.sprite(block.x, block.y - TILE, "coin1").play("coin-spin");
      this.tweens.add({ targets: coin, y: coin.y - 48, alpha: 0, duration: 500, onComplete: () => coin.destroy() });
    } else {
      this.spawnPowerUp(block.x, block.y - TILE, contents);
    }
  }

  private spawnPowerUp(x: number, y: number, kind: "heart" | "shield"): void {
    const powerUp = this.physics.add.staticImage(x, y + TILE, kind).setScale(1.5);
    this.tweens.add({
      targets: powerUp,
      y,
      duration: 300,
      onComplete: () => {
        powerUp.refreshBody();
        this.physics.add.overlap(this.player, powerUp, () => {
          powerUp.destroy();
          if (kind === "heart") {
            this.stage.lives = Math.min(this.stage.lives + 1, MAX_LIVES);
            this.hearts.set(this.stage.lives);
            this.floatText(x, y, "+1 LIFE", NES.lime);
          } else {
            this.hasShield = true;
            this.shieldIcon.setVisible(true);
            this.player.setTint(NES.sky);
            this.floatText(x, y, "HEDGE SHIELD!", NES.sky);
          }
        });
      },
    });
  }

  private collectCoin(coin: StaticSprite): void {
    coin.destroy();
    this.addCoins(1);
  }

  private addCoins(amount: number): void {
    this.coins += amount;
    this.coinText.setText(`x ${this.coins}`);
  }

  private floatText(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, textStyle(12, color)).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private touchBear(bear: Sprite): void {
    if (!bear.body.enable) return;
    const falling = this.player.body.velocity.y > 0;
    const fromAbove = this.player.body.bottom <= bear.body.top + 16;
    if (falling && fromAbove) {
      bear.body.enable = false;
      bear.anims.stop();
      bear.setTexture("bear-flat").setY(bear.y + 8);
      this.tweens.add({ targets: bear, alpha: 0, delay: 400, duration: 300, onComplete: () => bear.destroy() });
      this.player.setVelocityY(JUMP_VELOCITY * 0.6);
      this.addCoins(2);
      this.floatText(bear.x, bear.y - 24, "BEAR SHORTED!", NES.yellow);
      this.showNextFact();
    } else {
      this.damage();
    }
  }

  // A banner under the HUD that slides down with a fact from the paper and
  // hides itself after a few seconds. The game keeps running underneath.
  private createFactBanner(): void {
    const width = GAME_WIDTH - 40;
    const background = this.add.rectangle(0, 0, width, 64, NES.black, 0.9).setOrigin(0, 0).setStrokeStyle(4, NES.yellow);
    const label = this.add.text(12, 10, "FUN FACT", textStyle(8, NES.yellow));
    this.factText = this.add.text(12, 26, "", textStyle(12, NES.white, width - 24));
    this.factBanner = this.add
      .container(20, -80, [background, label, this.factText])
      .setScrollFactor(0)
      .setDepth(15);
  }

  private showNextFact(): void {
    const facts = this.stage.paper.worlds[this.stage.worldIndex].facts;
    if (facts.length === 0) return;
    // The registry outlives this scene, so facts keep cycling across levels.
    const index = ((this.registry.get(FACT_INDEX_KEY) as number | undefined) ?? 0) % facts.length;
    this.registry.set(FACT_INDEX_KEY, index + 1);
    this.factText.setText(facts[index]);

    this.tweens.killTweensOf(this.factBanner);
    this.tweens.add({ targets: this.factBanner, y: 56, duration: 250, ease: "Back.easeOut" });
    this.factHideTimer?.remove();
    this.factHideTimer = this.time.delayedCall(FACT_SHOWN_MS, () => {
      this.tweens.add({ targets: this.factBanner, y: -80, duration: 250 });
    });
  }

  private damage(): void {
    if (this.finished || this.time.now < this.invulnerableUntil) return;
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.jumping = false;
    this.player.setVelocityY(JUMP_VELOCITY * 0.6);
    this.cameras.main.shake(150, 0.01);
    this.tweens.add({ targets: this.player, alpha: 0.2, duration: 100, yoyo: true, repeat: 5 });

    if (this.hasShield) {
      this.hasShield = false;
      this.shieldIcon.setVisible(false);
      this.player.clearTint();
      this.floatText(this.player.x, this.player.y - 30, "SHIELD BROKE", NES.sky);
      return;
    }
    this.loseLife();
  }

  private fallIntoPit(): void {
    if (this.finished) return;
    if (this.loseLife()) this.scene.restart({ ...this.stage });
  }

  // Returns true if the player still has lives left.
  private loseLife(): boolean {
    this.stage.lives -= 1;
    this.hearts.set(this.stage.lives);
    if (this.stage.lives > 0) return true;
    this.gameOver();
    return false;
  }

  private reachGoal(): void {
    if (this.finished) return;
    this.finished = true;
    this.physics.pause();
    this.showPlayerFrame("player-jump");
    this.add
      .text(GAME_WIDTH / 2, 160, "LEVEL CLEAR!", textStyle(32, NES.yellow))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const cleared = this.stage.checkpointsCleared + 1;
    saveProgress({ paperId: this.stage.paper.id, worldIndex: this.stage.worldIndex, checkpointsCleared: cleared });
    const nextStage: StageData = { ...this.stage, checkpointsCleared: cleared };
    const nextScene = cleared >= world.cutscenes.length ? "Boss" : "Level";

    this.time.delayedCall(1200, () =>
      this.scene.start("Cutscene", {
        cutscene: world.cutscenes[this.stage.checkpointsCleared],
        lives: this.stage.lives,
        next: { scene: nextScene, data: nextStage },
      }),
    );
  }

  private gameOver(): void {
    this.finished = true;
    this.physics.pause();
    panel(this, 200, 110, 400, 230).setScrollFactor(0).setDepth(20);
    this.add.text(GAME_WIDTH / 2, 150, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    const menu = new Menu(this, 260, 220, [
      { label: "RETRY LEVEL", onSelect: () => this.scene.restart({ ...this.stage, lives: START_LIVES }) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
    menu.setDepth(21);
    menu.setScrollFactor(0);
  }
}
