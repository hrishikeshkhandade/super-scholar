import Phaser from "phaser";
import { audio } from "../audio/audio";
import { burst } from "../effects";
import { hashString, seededRandom } from "../generator/questions";
import { layoutFor } from "../levels/chooseLayout";
import { farKey, groundKey, groundTopKey, hillsKey } from "../levels/themeTextures";
import { themeFor, type Theme } from "../levels/themes";
import { TILE, isSolidTile, parseLevel, type BlockContents } from "../levels/parseLevel";
import { NES, css } from "../palette";
import { GRAVITY, JUMP_VELOCITY } from "../jump";
import { PlayerController, makeOneWay, type Sprite } from "../player";
import { advanceProgress, currentTuning, markCleared, saveBestStars, startLives, unlockNote } from "../save";
import { addPlayTime, practiceKey, recordStars } from "../run";
import { nextFact } from "../foundFacts";
import type { Tuning } from "../difficulty";
import { COIN_GOAL, levelStars } from "../stars";
import type { StageData } from "../stage";
import { enablePause } from "./PauseScene";
import { isTouchDevice } from "../touchControls";
import { GAME_HEIGHT, GAME_WIDTH, HeartBar, MAX_LIVES, Menu, TITLE_CARD_MS, fitTextToHeight, onceAdvance, panel, showStars, showTitleCard, textStyle, READING_BOX } from "../ui";

type StaticSprite = Phaser.Types.Physics.Arcade.SpriteWithStaticBody;

const BEAR_SPEED = 60;
const BUBBLE_BOB_SPEED = 70; // how fast bubbles drift up and down
const MOVING_PLATFORM_SPEED = 70;
const MOVING_PLATFORM_RANGE = TILE * 3;
const INVULNERABLE_MS = 1200;
const STOMP_TIP_MS = 2000;
const HUD_HEIGHT = 48;
const TICKER_TOP = HUD_HEIGHT + 6; // a small gap under the HUD
// The fun-fact card: fades in just under the HUD, in the reading column,
// with text the size of the lessons'. It turns see-through whenever the
// scholar is behind it, so it never hides the player.
const TICKER = {
  padding: 18,
  textTop: 28, // under the small FUN FACT tag
  maxTextHeight: 110, // four lines; the LEVEL CLEAR card has the full text
  slide: 8,
  minMs: 4000,
  msPerChar: 45,
  maxMs: 8000,
  behindAlpha: 0.2, // while the scholar is behind it
  playerMargin: 24,
};

export class LevelScene extends Phaser.Scene {
  private stage!: StageData;
  private rows: string[] = [];
  private controls!: PlayerController;
  private player!: Sprite;
  private solids!: Phaser.Physics.Arcade.StaticGroup;
  private blocks!: Phaser.Physics.Arcade.StaticGroup;
  private platformCollider!: Phaser.Physics.Arcade.Collider;
  private movingPlatforms!: Phaser.Physics.Arcade.Group;
  private bears!: Phaser.Physics.Arcade.Group;
  private bubbles!: Phaser.Physics.Arcade.Group;
  private skyline!: Phaser.GameObjects.TileSprite;
  private hills!: Phaser.GameObjects.TileSprite;
  private theme!: Theme;
  private hearts!: HeartBar;
  private coinText!: Phaser.GameObjects.Text;
  private shieldIcon!: Phaser.GameObjects.Image;
  private factsFound: number[] = [];
  private stompTip?: Phaser.GameObjects.Container;
  private playMs = 0; // for the leaderboard run, saved when the level ends
  private ticker!: Phaser.GameObjects.Container;
  private tickerChain?: Phaser.Tweens.TweenChain;
  private tickerContent!: Phaser.GameObjects.Container; // dims when the scholar is behind it
  private tickerBackground!: Phaser.GameObjects.Rectangle;
  private tickerText!: Phaser.GameObjects.Text;
  private controlsHint!: Phaser.GameObjects.Text;
  private tuning!: Tuning;
  private coins = 0;
  private coinsInLevel = 0;
  private hits = 0;
  private hasShield = false;
  private invulnerableUntil = 0;
  private finished = false;
  private cardShowing: () => boolean = () => false;

  constructor() {
    super("Level");
  }

  create(data: StageData): void {
    this.stage = { ...data };
    this.coins = 0;
    this.hits = data.levelHits ?? 0;
    this.factsFound = data.levelFacts ?? [];
    this.playMs = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (!this.stage.replay) addPlayTime(this.stage.paper.id, this.playMs);
    });
    this.tuning = currentTuning();
    this.hasShield = false;
    this.invulnerableUntil = 0;
    this.finished = false;

    this.theme = themeFor(hashString(this.stage.paper.id), this.stage.worldIndex, this.stage.checkpointsCleared);
    const layout = layoutFor(this.stage.paper.id, this.stage.worldIndex, this.stage.checkpointsCleared);
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
    audio.playMusic("level");

    this.solids = this.physics.add.staticGroup();
    for (const tile of level.ground) this.solids.create(center(tile).x, center(tile).y, tile.top ? groundTopKey(this.theme) : groundKey(this.theme));
    for (const tile of level.bricks) this.solids.create(center(tile).x, center(tile).y, "brick");

    this.blocks = this.physics.add.staticGroup();
    for (const block of level.blocks) {
      const sprite = this.blocks.create(center(block).x, center(block).y, "question-block") as StaticSprite;
      sprite.setData("contents", block.contents);
    }

    const platforms = this.physics.add.staticGroup();
    for (const tile of level.platforms) {
      const platform = platforms.create(center(tile).x, tile.y * TILE + 6, "platform") as StaticSprite;
      makeOneWay(platform.body);
    }

    this.movingPlatforms = this.physics.add.group({ allowGravity: false, immovable: true });
    for (const tile of level.movingPlatforms) {
      const platform = this.movingPlatforms.create(tile.x * TILE + 48, tile.y * TILE + 6, "moving-platform") as Sprite;
      makeOneWay(platform.body);
      platform.setData("minX", platform.x);
      platform.setVelocityX(MOVING_PLATFORM_SPEED);
    }

    const spikes = this.physics.add.staticGroup();
    for (const tile of level.spikes) {
      const spike = spikes.create(center(tile).x, center(tile).y, "spike") as StaticSprite;
      spike.body.setSize(20, 18).setOffset(6, 14);
    }

    this.coinsInLevel = level.coins.length;
    const coins = this.physics.add.staticGroup();
    for (const tile of level.coins) {
      (coins.create(center(tile).x, center(tile).y, "coin1") as StaticSprite).play("coin-spin");
    }

    this.bears = this.physics.add.group();
    for (const tile of level.bears) {
      const bear = this.bears.create(center(tile).x, center(tile).y, "bear-walk1") as Sprite;
      bear.play("bear-walk").setVelocityX(-BEAR_SPEED * this.tuning.bearSpeed);
      bear.body.setSize(32, 28).setOffset(4, 4);
    }

    // Market bubbles float in place, bobbing up and down.
    this.bubbles = this.physics.add.group({ allowGravity: false, immovable: true });
    level.bubbles.forEach((tile, i) => {
      const bubble = this.bubbles.create(center(tile).x, center(tile).y, "bubble") as Sprite;
      bubble.setData("phase", i * 1.7);
      bubble.body.setCircle(14, 2, 2);
    });

    const goal = this.physics.add.staticImage(center(level.goal).x, (level.goal.y + 1) * TILE - 80, "flagpole");
    goal.body.setSize(16, 160);

    this.controls = new PlayerController(this, center(level.start).x, center(level.start).y, () =>
      this.dropThroughPlatform(),
    );
    this.player = this.controls.sprite;

    this.physics.add.collider(this.player, this.solids);
    this.physics.add.collider(this.player, this.blocks, (_player, block) => this.bumpBlock(block as StaticSprite));
    this.platformCollider = this.physics.add.collider(this.player, platforms);
    this.physics.add.collider(this.player, this.movingPlatforms);
    this.physics.add.collider(this.bears, this.solids);
    this.physics.add.collider(this.bears, this.blocks);
    this.physics.add.overlap(this.player, coins, (_player, coin) => this.collectCoin(coin as StaticSprite));
    this.physics.add.overlap(this.player, spikes, (_player, spike) => this.damage((spike as StaticSprite).x));
    this.physics.add.overlap(this.player, this.bears, (_player, bear) => this.touchBear(bear as Sprite));
    this.physics.add.overlap(this.player, this.bubbles, (_player, bubble) => this.touchBubble(bubble as Sprite));
    this.physics.add.overlap(this.player, goal, () => this.reachGoal());

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    // A firmer follow (0.25) keeps the player from shimmering against the
    // pixel grid while the camera catches up.
    this.cameras.main.startFollow(this.player, true, 0.25, 0.25);
    this.cameras.main.setDeadzone(120, 80);

    this.drawHud(layout.name);
    enablePause(this, () => !this.finished && !this.cardShowing());
  }

  // Sky in NES-style color bands, then far scenery and hills that scroll
  // slower than the level (parallax), all in this level's theme.
  private drawBackground(): void {
    const theme = this.theme;
    this.cameras.main.setBackgroundColor(theme.sky[2]);
    const bandHeight = 70;
    theme.sky.slice(0, 2).forEach((color, i) => {
      this.add.rectangle(0, i * bandHeight, GAME_WIDTH, bandHeight, color).setOrigin(0, 0).setScrollFactor(0);
    });
    if (theme.stars) {
      const random = seededRandom(hashString(theme.name));
      for (let i = 0; i < 40; i++) {
        const star = this.add.rectangle(random() * GAME_WIDTH, random() * 200, 2, 2, NES.white).setScrollFactor(0.05);
        this.tweens.add({ targets: star, alpha: 0.2, duration: 600 + random() * 900, yoyo: true, repeat: -1 });
      }
    }
    this.skyline = this.add.tileSprite(0, GAME_HEIGHT - 260, GAME_WIDTH, 200, farKey(theme)).setOrigin(0, 0).setScrollFactor(0);
    this.hills = this.add.tileSprite(0, GAME_HEIGHT - 150, GAME_WIDTH, 128, hillsKey(theme)).setOrigin(0, 0).setScrollFactor(0);
    for (let i = 0; i < 6; i++) {
      this.add.image(80 + i * 260, 50 + (i % 3) * 30, "cloud").setScrollFactor(0.1).setAlpha(theme.cloudAlpha);
    }
  }

  private drawHud(levelName: string): void {
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor>(object: T) => object.setScrollFactor(0);
    fixed(this.add.rectangle(0, 0, GAME_WIDTH, HUD_HEIGHT, NES.black, 0.6).setOrigin(0, 0).setDepth(9));
    this.hearts = new HeartBar(this, 16, 14);
    this.hearts.set(this.stage.lives);
    this.shieldIcon = fixed(this.add.image(196, 24, "shield").setDepth(10).setVisible(false));
    fixed(this.add.image(240, 24, "coin1").setDepth(10));
    this.coinText = fixed(this.add.text(256, 18, "x 0", textStyle(16, NES.white)).setDepth(10));
    if (this.tuning.hudLabel) fixed(this.add.text(352, 18, this.tuning.hudLabel, textStyle(16, NES.red)).setDepth(10));
    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const label = `${this.stage.worldIndex + 1}-${this.stage.checkpointsCleared + 1} ${levelName.toUpperCase()}`;
    fixed(this.add.text(GAME_WIDTH - 16, 8, label, textStyle(16, NES.yellow)).setOrigin(1, 0).setDepth(10));
    fixed(this.add.text(GAME_WIDTH - 16, 30, world.name.toUpperCase(), textStyle(8, NES.lightGray)).setOrigin(1, 0).setDepth(10));
    const hint = (this.controlsHint = fixed(
      this.add.text(GAME_WIDTH / 2, 70, isTouchDevice() ? "TAP THE BUTTONS TO MOVE AND JUMP" : "A/D MOVE  W JUMP  S DROP  ESC PAUSE", textStyle(16, NES.white)).setOrigin(0.5).setDepth(10),
    ));
    // A pit fall restarts the level; showing the title card again every time
    // would get in the way, so it only shows on a fresh start.
    const freshStart = (this.stage.levelHits ?? 0) === 0;
    const cardMs = freshStart ? TITLE_CARD_MS : 0;
    this.tweens.add({ targets: hint, alpha: 0, delay: 4000 + cardMs, duration: 800 });
    const firstLevel = this.stage.worldIndex === 0 && this.stage.checkpointsCleared === 0;
    this.createFactTicker();
    if (freshStart) {
      this.cardShowing = showTitleCard(
        this,
        { title: `WORLD ${this.stage.worldIndex + 1}-${this.stage.checkpointsCleared + 1}`, subtitle: levelName.toUpperCase(), detail: world.name },
        () => firstLevel && this.showStompTip(),
      );
    } else if (firstLevel) {
      this.showStompTip();
    }
  }

  // At the start of every paper: a quick reminder that bears hold fun facts.
  private showStompTip(): void {
    const tip = (this.stompTip = this.add
      .container(GAME_WIDTH / 2, 130, [
        this.add.rectangle(0, 0, 580, 56, NES.black, 0.85).setStrokeStyle(4, NES.yellow),
        this.add.image(-250, 0, "bear-walk1"),
        this.add.text(20, 0, "STOMP BEARS TO COLLECT FACTS!", textStyle(16, NES.yellow)).setOrigin(0.5),
      ])
      .setScrollFactor(0)
      .setDepth(15)
      .setAlpha(0));
    this.tweens.chain({
      targets: tip,
      tweens: [
        { alpha: 1, duration: 200 },
        { alpha: 0, delay: STOMP_TIP_MS, duration: 300, onComplete: () => tip.destroy() },
      ],
    });
  }

  update(time: number, deltaMs: number): void {
    this.controls.touch?.setVisible(!this.finished);
    if (this.finished) return;
    // Only time spent actually playing counts (not the title card).
    if (!this.cardShowing()) this.playMs += deltaMs;
    this.controls.update(time);
    this.updateFactTicker();
    this.updateBears();
    this.updateMovingPlatforms();
    this.updateBubbles(time);
    this.skyline.tilePositionX = this.cameras.main.scrollX * 0.2;
    this.hills.tilePositionX = this.cameras.main.scrollX * 0.4;
    if (this.player.y > this.rows.length * TILE + TILE) this.fallIntoPit();
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
      bear.setVelocityX(direction * BEAR_SPEED * this.tuning.bearSpeed).setFlipX(direction > 0);
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

  private updateBubbles(time: number): void {
    for (const object of this.bubbles.getChildren()) {
      const bubble = object as Sprite;
      bubble.setVelocityY(Math.cos(time / 400 + (bubble.getData("phase") as number)) * BUBBLE_BOB_SPEED);
    }
  }

  // Landing on a bubble pops it for a coin; touching it any other way hurts.
  private touchBubble(bubble: Sprite): void {
    const falling = this.player.body.velocity.y > 0;
    if (falling && this.player.body.bottom <= bubble.body.top + 14) {
      audio.playSfx("stomp");
      burst(this, bubble.x, bubble.y, [NES.sky, NES.white], { count: 16, gravity: 200 });
      this.controls.bounce(JUMP_VELOCITY * 0.7);
      this.floatText(bubble.x, bubble.y - 20, "BUBBLE POPPED!", NES.sky);
      this.addCoins(1);
      bubble.destroy();
    } else {
      this.damage(bubble.x);
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
    audio.playSfx("bump");
    this.tweens.add({ targets: block, y: block.y - 8, duration: 80, yoyo: true });
    const contents = block.getData("contents") as BlockContents;
    if (contents === "coin") {
      this.addCoins(1);
      burst(this, block.x, block.y - TILE, [NES.yellow, NES.white], { count: 6, speed: 100 });
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
          audio.playSfx("powerup");
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
    burst(this, coin.x, coin.y, [NES.yellow, NES.white], { count: 6, speed: 100, lifespanMs: 300 });
    coin.destroy();
    this.addCoins(1);
  }

  private addCoins(amount: number): void {
    audio.playSfx("coin");
    this.coins += amount;
    this.coinText.setText(`x ${this.coins}`);
  }

  private floatText(x: number, y: number, message: string, color: number): void {
    const text = this.add.text(x, y, message, textStyle(16, color)).setOrigin(0.5).setStroke(css(NES.black), 4).setDepth(8);
    // Near the screen's edge, slide the text in so none of it is cut off.
    const view = this.cameras.main.worldView;
    const half = text.width / 2 + 8;
    text.x = Phaser.Math.Clamp(x, view.left + half, view.right - half);
    this.tweens.add({ targets: text, y: y - 40, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private touchBear(bear: Sprite): void {
    if (!bear.body.enable) return;
    const falling = this.player.body.velocity.y > 0;
    const fromAbove = this.player.body.bottom <= bear.body.top + 16;
    if (falling && fromAbove) {
      bear.body.enable = false;
      audio.playSfx("stomp");
      burst(this, bear.x, bear.y, [NES.brown, NES.tan, NES.white]);
      bear.anims.stop();
      bear.setTexture("bear-flat").setY(bear.y + 8);
      this.tweens.add({ targets: bear, alpha: 0, delay: 400, duration: 300, onComplete: () => bear.destroy() });
      this.controls.bounce(JUMP_VELOCITY * 0.6);
      this.addCoins(2);
      this.floatText(bear.x, bear.y - 24, "BEAR SHORTED!", NES.yellow);
      this.collectFact(bear.x, bear.y - 52);
    } else {
      this.damage(bear.x);
    }
  }

  // Stomping a bear collects one of this level's facts without covering the
  // level: a "+FACT" pops up, the fact shows in a slim ticker under the HUD,
  // and the facts found are listed again on the LEVEL CLEAR card. Once the
  // level's facts are all found, bears say so instead of repeating one.
  private collectFact(x: number, y: number): void {
    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const facts = world.facts;
    const index = nextFact(this.factsFound, facts.length, world.cutscenes.length, this.stage.checkpointsCleared);
    if (index === undefined) {
      this.floatText(x, y, "ALL FACTS FOUND", NES.lightGray);
      return;
    }
    unlockNote(this.stage.paper.id, this.stage.worldIndex, "fact", index);
    this.factsFound = [...this.factsFound, index];
    audio.playSfx("powerup");
    this.floatText(x, y, "+FACT", NES.lime);
    // The first fact shows where the tip is, and the tip has done its job.
    if (this.stompTip?.active) {
      this.tweens.killTweensOf(this.stompTip);
      this.stompTip.destroy();
    }
    this.showFactTicker(facts[index]);
  }

  private createFactTicker(): void {
    this.tickerBackground = this.add.rectangle(0, 0, READING_BOX.width, 0, NES.black, 0.75).setOrigin(0, 0).setStrokeStyle(2, NES.yellow);
    const label = this.add.text(TICKER.padding, 10, "FUN FACT", textStyle(8, NES.yellow));
    this.tickerText = this.add.text(TICKER.padding, TICKER.textTop, "", textStyle(16, NES.white, READING_BOX.width - TICKER.padding * 2));
    this.tickerContent = this.add.container(0, 0, [this.tickerBackground, label, this.tickerText]);
    this.ticker = this.add.container(READING_BOX.x, 0, [this.tickerContent]).setScrollFactor(0).setDepth(10).setAlpha(0);
  }

  // See-through while the scholar is behind the card, solid otherwise.
  private updateFactTicker(): void {
    if (this.ticker.alpha === 0) return;
    const camera = this.cameras.main;
    const x = this.player.x - camera.scrollX;
    const y = this.player.y - camera.scrollY;
    const margin = TICKER.playerMargin;
    const behind =
      x > this.ticker.x - margin &&
      x < this.ticker.x + READING_BOX.width + margin &&
      y < this.ticker.y + this.tickerBackground.height + margin;
    const target = behind ? TICKER.behindAlpha : 1;
    this.tickerContent.setAlpha(Phaser.Math.Linear(this.tickerContent.alpha, target, 0.2));
  }

  private showFactTicker(fact: string): void {
    // The controls hint sits in the same spot early in a level.
    this.tweens.killTweensOf(this.controlsHint);
    this.controlsHint.setAlpha(0);
    this.tickerText.setText(fact);
    fitTextToHeight(this.tickerText, TICKER.maxTextHeight); // the end card has the full text
    const height = TICKER.textTop + this.tickerText.height + 14;
    this.tickerBackground.setSize(READING_BOX.width, height);
    const shownMs = Phaser.Math.Clamp(TICKER.minMs + fact.length * TICKER.msPerChar, TICKER.minMs, TICKER.maxMs);
    this.hideFactTicker();
    this.ticker.setY(TICKER_TOP - TICKER.slide).setAlpha(0);
    this.tickerChain = this.tweens.chain({
      targets: this.ticker,
      tweens: [
        { y: TICKER_TOP, alpha: 1, duration: 200, ease: "Quad.easeOut" },
        { alpha: 0, delay: shownMs, duration: 300 },
      ],
    });
  }

  private hideFactTicker(): void {
    this.tickerChain?.stop();
    this.tickerChain = undefined;
    this.ticker.setAlpha(0);
  }

  // After LEVEL CLEAR: the facts found in this level, one page each, then onDone.
  private showFoundFacts(onDone: () => void): void {
    const facts = this.stage.paper.worlds[this.stage.worldIndex].facts;
    if (this.factsFound.length === 0) {
      onDone();
      return;
    }
    const fixed = <T extends Phaser.GameObjects.Components.ScrollFactor & Phaser.GameObjects.Components.Depth>(object: T) =>
      object.setScrollFactor(0).setDepth(30);
    const box = { x: 60, y: 110, width: GAME_WIDTH - 120, height: 230 };
    fixed(this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, NES.black, 0.6).setOrigin(0, 0));
    fixed(panel(this, box.x, box.y, box.width, box.height).setStrokeStyle(4, NES.yellow));
    const heading = fixed(this.add.text(GAME_WIDTH / 2, box.y + 26, "", textStyle(16, NES.yellow)).setOrigin(0.5));
    const body = fixed(this.add.text(box.x + 24, box.y + 56, "", textStyle(16, NES.white, box.width - 48)));
    const prompt = fixed(this.add.text(GAME_WIDTH / 2, box.y + box.height - 22, "", textStyle(8, NES.lightGray)).setOrigin(0.5));
    const press = isTouchDevice() ? "TAP" : "SPACE";

    const showPage = (page: number) => {
      const last = page === this.factsFound.length - 1;
      heading.setText(`FACTS FOUND  ${page + 1}/${this.factsFound.length}`);
      body.setText(facts[this.factsFound[page]]);
      fitTextToHeight(body, prompt.y - 16 - body.y);
      prompt.setText(`${press}: ${last ? "CONTINUE" : "NEXT FACT"}`);
      onceAdvance(this, () => {
        audio.playSfx("select");
        if (last) onDone();
        else showPage(page + 1);
      });
    };
    showPage(0);
  }

  private damage(fromX: number): void {
    if (this.finished || this.time.now < this.invulnerableUntil) return;
    this.invulnerableUntil = this.time.now + INVULNERABLE_MS;
    this.hits += 1;
    this.controls.knockback(fromX);
    audio.playSfx("hurt");
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
    audio.playSfx("fall");
    if (this.loseLife()) this.scene.restart({ ...this.stage, levelHits: this.hits + 1, levelFacts: this.factsFound });
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
    this.hideFactTicker(); // so it can't sit over "LEVEL CLEAR!"
    audio.playSfx("clear");
    this.controls.showFrame("player-jump");
    this.add
      .text(GAME_WIDTH / 2, 160, "LEVEL CLEAR!", textStyle(32, NES.yellow))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);

    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const cleared = this.stage.checkpointsCleared + 1;
    markCleared(this.stage.paper.id, this.stage.worldIndex, this.stage.checkpointsCleared);
    advanceProgress({ paperId: this.stage.paper.id, worldIndex: this.stage.worldIndex, checkpointsCleared: cleared });
    unlockNote(this.stage.paper.id, this.stage.worldIndex, "lesson", this.stage.checkpointsCleared);
    const nextStage: StageData = { ...this.stage, checkpointsCleared: cleared, levelHits: 0, levelFacts: [] };

    const stars = levelStars({ coinsCollected: this.coins, coinsInLevel: this.coinsInLevel, hits: this.hits });
    saveBestStars(this.stage.paper.id, this.stage.worldIndex, this.stage.checkpointsCleared, stars);
    if (!this.stage.replay) recordStars(this.stage.paper.id, this.stage.worldIndex, this.stage.checkpointsCleared, stars);
    // A dark band so the stars stand out from the level behind them.
    this.add.rectangle(GAME_WIDTH / 2, 228, 360, 64, NES.black, 0.75).setScrollFactor(0).setDepth(19);
    for (const star of showStars(this, GAME_WIDTH / 2, 214, stars)) star.setScrollFactor(0).setDepth(20);
    const coinGoal = Math.ceil(this.coinsInLevel * COIN_GOAL);
    this.add
      .text(GAME_WIDTH / 2, 248, `COINS ${this.coins}/${this.coinsInLevel}   STAR AT ${coinGoal}   HITS ${this.hits}`, textStyle(8, NES.white))
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(20);
    const nextScene = cleared >= world.cutscenes.length ? "Boss" : "Level";

    // Long enough to see the stars before the facts card and the lesson.
    this.time.delayedCall(2200, () =>
      this.showFoundFacts(() =>
        this.scene.start("Cutscene", {
          cutscene: world.cutscenes[this.stage.checkpointsCleared],
          lives: this.stage.lives,
          askAbout: this.stage.paper.title,
          runQuestion: this.stage.replay
            ? undefined
            : { paperId: this.stage.paper.id, key: practiceKey(this.stage.worldIndex, this.stage.checkpointsCleared) },
          next: { scene: nextScene, data: nextStage },
        }),
      ),
    );
  }

  private gameOver(): void {
    audio.playSfx("gameover");
    this.finished = true;
    this.physics.pause();
    panel(this, 200, 110, 400, 230).setScrollFactor(0).setDepth(20);
    this.add.text(GAME_WIDTH / 2, 150, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5).setScrollFactor(0).setDepth(20);
    const menu = new Menu(this, 260, 220, [
      { label: "RETRY LEVEL", onSelect: () => this.scene.restart({ ...this.stage, lives: startLives(), levelHits: 0, levelFacts: [] }) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
    menu.setDepth(21);
    menu.setScrollFactor(0);
  }
}
