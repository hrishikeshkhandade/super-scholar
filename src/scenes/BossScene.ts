import Phaser from "phaser";
import { audio } from "../audio/audio";
import { burst } from "../effects";
import { BossFight } from "../bossFight";
import { BOSS_STYLE_NAMES, bossStyleFor, type BossStyle } from "../bossStyles";
import { TILE } from "../levels/parseLevel";
import { farKey } from "../levels/themeTextures";
import { THEMES } from "../levels/themes";
import { NES } from "../palette";
import { GRAVITY, JUMP_VELOCITY } from "../jump";
import { PlayerController, makeOneWay, type Sprite } from "../player";
import { advanceProgress, currentTuning, markCleared, saveBestStars, startLives, unlockNote } from "../save";
import type { Tuning } from "../difficulty";
import { addPlayTime, bossQuestionKey, finishRun, recordAnswer, recordStars, runResult, loadRun } from "../run";
import { formatTime } from "../leaderboard";
import { bossStars } from "../stars";
import type { StageData } from "../stage";
import { enablePause } from "./PauseScene";
import type { BossArena, BossBehavior } from "./bosses/arena";
import { Charger } from "./bosses/charger";
import { Flyer } from "./bosses/flyer";
import { Jumper } from "./bosses/jumper";
import { Summoner } from "./bosses/summoner";
import { Thrower } from "./bosses/thrower";
import {
  GAME_HEIGHT,
  GAME_WIDTH,
  HeartBar,
  Menu,
  QuestionPanel,
  READING,
  READING_BOX,
  onceAdvance,
  TITLE_CARD_MS,
  panel,
  showStars,
  showTitleCard,
  textStyle,
} from "../ui";

// The boss fight is an arena: dodge the boss's attacks and stomp it to pause
// the fight for a question. Right answers damage it. How the boss moves and
// attacks depends on the world (see bossStyles.ts and the bosses folder).

type Mode = "intro" | "fight" | "question" | "over";
type StaticSprite = Phaser.Types.Physics.Arcade.SpriteWithStaticBody;

const FLOOR_Y = 12 * TILE;
const PANEL_TOP = 200;
const FEEDBACK_MIN_HEIGHT = 230;
const BAR = { x: 480, y: 34, width: 300, height: 16 };
const PAUSE_BUTTON_X = 337; // between the HARD label and the RAGE meter
// Tuned to be a fun obstacle, not a wall: the game is about enjoying a hard
// paper, so a player still learning the answers should be able to win.
// Wrong answers make the boss a little angrier (rage), never much harder.
const INTRO_MS = 2000;
const PLAYER_INVULNERABLE_MS = 1500;
const STOMP_COOLDOWN_MS = 1500;
const RAGE_SPEEDUP = 0.12; // each rage level makes it 12% faster
const ATTACK_EVERY_MS = 3200;
const RAGE_ATTACK_SOONER_MS = 300;
// Stars circling over the boss's head while it's dizzy and safe to stomp.
const DIZZY_STARS = 3;
const DIZZY_ORBIT = { width: 34, height: 8, above: 14, msPerTurn: 900 };

const BEHAVIORS: Record<BossStyle, (arena: BossArena) => BossBehavior> = {
  charger: (arena) => new Charger(arena),
  jumper: (arena) => new Jumper(arena),
  thrower: (arena) => new Thrower(arena),
  summoner: (arena) => new Summoner(arena),
  flyer: (arena) => new Flyer(arena),
};

export class BossScene extends Phaser.Scene {
  private stage!: StageData;
  private fight!: BossFight;
  private controls!: PlayerController;
  private player!: Sprite;
  private boss!: Sprite;
  private behavior!: BossBehavior;
  private hearts!: HeartBar;
  private dizzyStars: Phaser.GameObjects.Image[] = [];
  private healthFill!: Phaser.GameObjects.Rectangle;
  private rageText!: Phaser.GameObjects.Text;
  private mode: Mode = "intro";
  private introMs = 0;
  private invulnerableUntil = 0;
  private hits = 0;
  private cardShowing: () => boolean = () => false;
  private stompableAt = 0;
  private tuning!: Tuning;
  private playMs = 0; // for the leaderboard run, saved when the fight ends

  constructor() {
    super("Boss");
  }

  create(data: StageData): void {
    this.stage = { ...data };
    const world = data.paper.worlds[data.worldIndex];
    this.fight = new BossFight(world.boss.questions);
    this.mode = "intro";
    this.hits = 0;
    // The title card freezes the arena first, so the intro waits for it.
    this.introMs = INTRO_MS + TITLE_CARD_MS;
    this.invulnerableUntil = 0;
    this.stompableAt = 0;
    this.tuning = currentTuning();
    this.playMs = 0;
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.savePlayTime());

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

    const hazards = this.physics.add.group();
    this.physics.add.collider(this.player, floor);
    this.physics.add.collider(this.player, platforms);
    this.physics.add.collider(this.boss, floor);
    this.physics.add.overlap(this.player, this.boss, () => this.touchBoss());
    this.physics.add.overlap(this.player, hazards, (_player, hazard) => {
      (hazard as Sprite).destroy();
      this.damage((hazard as Sprite).x);
    });

    const scene = this;
    const style = bossStyleFor(data.worldIndex);
    this.behavior = BEHAVIORS[style]({
      scene,
      boss: this.boss,
      player: this.player,
      floor,
      floorY: FLOOR_Y,
      hazards,
      get rage() {
        return scene.rage;
      },
      speedScale: () => this.tuning.bossSpeed * (1 + this.rage * RAGE_SPEEDUP),
      attackDelay: () => (ATTACK_EVERY_MS - this.rage * RAGE_ATTACK_SOONER_MS) * this.tuning.bossAttackEvery,
      hurtPlayer: (fromX) => this.damage(fromX),
      bouncePlayer: () => this.controls.bounce(JUMP_VELOCITY * 0.6),
    });

    this.dizzyStars = Array.from({ length: DIZZY_STARS }, () => this.add.image(0, 0, "star").setScale(0.6).setVisible(false));
    this.drawHud(world.boss.name);
    // No pausing during a question: the fight is already stopped then.
    enablePause(this, () => this.mode !== "question" && this.mode !== "over" && !this.cardShowing(), PAUSE_BUTTON_X);
    this.cardShowing = showTitleCard(this, {
      title: `WORLD ${this.stage.worldIndex + 1} BOSS`,
      subtitle: world.boss.name,
      detail: BOSS_STYLE_NAMES[style],
    });
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
    if (this.tuning.hudLabel) this.add.text(210, 18, this.tuning.hudLabel, textStyle(16, NES.red));
    this.add.text(BAR.x, 10, bossName, textStyle(16, NES.salmon));
    this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.gray).setOrigin(0, 0).setStrokeStyle(2, NES.white);
    this.healthFill = this.add.rectangle(BAR.x, BAR.y, BAR.width, BAR.height, NES.red).setOrigin(0, 0);
    this.rageText = this.add.text(BAR.x - 16, 36, "", textStyle(8, NES.red)).setOrigin(1, 0);

    const hint = this.add
      .text(GAME_WIDTH / 2, 130, "STOMP THE BOSS TO ANSWER!\n" + this.behavior.hint, textStyle(16, NES.yellow))
      .setOrigin(0.5)
      .setAlign("center");
    this.tweens.add({ targets: hint, alpha: 0, delay: INTRO_MS + TITLE_CARD_MS, duration: 600 });
  }

  update(time: number, deltaMs: number): void {
    const fighting = this.mode !== "question" && this.mode !== "over";
    this.controls.touch?.setVisible(fighting);
    if (!fighting) return;
    this.controls.update(time);
    if (this.mode === "intro") {
      this.introMs -= deltaMs;
      if (this.introMs <= 0) this.startFighting();
      return;
    }
    this.playMs += deltaMs;
    this.behavior.update(deltaMs);
    this.updateDizzyStars(time);
  }

  private savePlayTime(): void {
    if (!this.stage.replay) addPlayTime(this.stage.paper.id, this.playMs);
    this.playMs = 0;
  }

  private updateDizzyStars(time: number): void {
    const dizzy = this.behavior.harmless;
    const turn = (time / DIZZY_ORBIT.msPerTurn) * Math.PI * 2;
    this.dizzyStars.forEach((star, i) => {
      const angle = turn + (i * Math.PI * 2) / DIZZY_STARS;
      star
        .setVisible(dizzy)
        .setPosition(
          this.boss.x + Math.cos(angle) * DIZZY_ORBIT.width,
          this.boss.body.top - DIZZY_ORBIT.above + Math.sin(angle) * DIZZY_ORBIT.height,
        );
    });
  }

  private startFighting(): void {
    this.mode = "fight";
    this.behavior.resume();
  }

  private get rage(): number {
    return this.fight.rage;
  }

  private touchBoss(): void {
    if (this.mode === "intro") return;
    const falling = this.player.body.velocity.y > 0;
    const fromAbove = this.player.body.bottom <= this.boss.body.top + 20;
    if (falling && fromAbove && this.time.now >= this.stompableAt) this.stomp();
    // A stunned boss is dizzy and harmless: that's the moment to jump on it.
    else if (!this.behavior.harmless) this.damage(this.boss.x);
  }

  private stomp(): void {
    audio.playSfx("stomp");
    this.controls.bounce(JUMP_VELOCITY * 0.8);
    this.boss.clearTint();
    this.dizzyStars.forEach((star) => star.setVisible(false));
    this.cameras.main.shake(150, 0.01);
    this.mode = "question";
    this.physics.pause();
    this.time.delayedCall(250, () => this.askQuestion());
  }

  private askQuestion(): void {
    const question = this.fight.current;
    if (!question) return;
    const world = this.stage.paper.worlds[this.stage.worldIndex];
    const questionIndex = world.boss.questions.indexOf(question);
    unlockNote(this.stage.paper.id, this.stage.worldIndex, "boss", questionIndex);
    const questionPanel = new QuestionPanel(this, question, PANEL_TOP, (choiceIndex) => {
      questionPanel.destroy();
      const correct = this.fight.answer(choiceIndex);
      if (!this.stage.replay) recordAnswer(this.stage.paper.id, bossQuestionKey(this.stage.worldIndex, questionIndex), correct);
      // Tagged in the Notebook so the player can find it to study.
      if (!correct) unlockNote(this.stage.paper.id, this.stage.worldIndex, "missed", questionIndex);
      this.showFeedback(correct, question.choices[question.answerIndex], question.explanation);
    });
  }

  private showFeedback(correct: boolean, answer: string, explanation: string): void {
    if (correct) {
      this.tweens.add({
        targets: this.healthFill,
        width: (BAR.width * this.fight.health) / this.fight.maxHealth,
        duration: 300,
      });
      this.flash(this.boss);
      burst(this, this.boss.x, this.boss.y - 20, [NES.red, NES.yellow, NES.white], { count: 24, speed: 240 });
    } else {
      this.rageText.setText(`RAGE ${"!".repeat(this.rage)}`);
      this.boss.setTint(NES.salmon);
    }

    const heading = correct ? "HIT! BOSS TAKES DAMAGE" : "WRONG! THE BOSS GETS ANGRIER";
    const detail = correct ? explanation : `Answer: ${answer}\n\n${explanation}`;
    // The box grows upward to fit the explanation in the reading column.
    const detailText = this.add.text(READING.x, 0, detail, textStyle(16, NES.white, READING.width)).setDepth(1);
    const height = Math.max(FEEDBACK_MIN_HEIGHT, detailText.height + 100);
    const top = Math.min(PANEL_TOP, GAME_HEIGHT - 20 - height);
    detailText.setY(top + 60);
    const feedback = [
      panel(this, READING_BOX.x, top, READING_BOX.width, height),
      this.add.text(READING.x, top + 20, heading, textStyle(16, correct ? NES.lime : NES.salmon)).setDepth(1),
      detailText,
      this.add.text(READING_BOX.x + READING_BOX.width - 20, top + height - 16, "SPACE / CLICK", textStyle(8, NES.yellow)).setOrigin(1, 1).setDepth(1),
    ];
    onceAdvance(this, () => {
      feedback.forEach((object) => object.destroy());
      if (this.fight.defeated) this.win();
      else this.resumeFight();
    });
  }

  private resumeFight(): void {
    this.physics.resume();
    this.startFighting();
    this.stompableAt = this.time.now + STOMP_COOLDOWN_MS;
    this.invulnerableUntil = this.time.now + PLAYER_INVULNERABLE_MS;
  }

  private damage(fromX: number): void {
    if (this.mode === "over" || this.time.now < this.invulnerableUntil) return;
    this.invulnerableUntil = this.time.now + PLAYER_INVULNERABLE_MS;
    this.hits += 1;
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
    this.behavior.end();
    this.dizzyStars.forEach((star) => star.setVisible(false));
  }

  private win(): void {
    this.endFight();
    const { paper, worldIndex } = this.stage;
    const nextWorld = worldIndex + 1;
    const hasNextWorld = nextWorld < paper.worlds.length;
    audio.playSfx("clear");
    markCleared(paper.id, worldIndex, "boss");
    // After the last world, progress points past the end: the paper is
    // finished, so CONTINUE turns off but the level select stays fully lit.
    advanceProgress({ paperId: paper.id, worldIndex: nextWorld, checkpointsCleared: 0 });

    this.tweens.add({ targets: this.boss, alpha: 0, angle: 90, y: this.boss.y + 40, duration: 800 });
    const stars = bossStars({ wrongAnswers: this.fight.wrongAnswers, hits: this.hits });
    saveBestStars(paper.id, worldIndex, "boss", stars);
    const { replay } = this.stage;
    if (!replay) recordStars(paper.id, worldIndex, "boss", stars);

    // The end of a full playthrough: its score for the leaderboard.
    this.savePlayTime();
    const run = !hasNextWorld && !replay ? loadRun(paper.id) : undefined;
    if (run) finishRun(paper.id);
    const result = run && runResult(paper, run);

    const missed = this.fight.missed;
    const items = [
      ...(missed.length > 0
        ? [
            {
              label: `REVIEW MISSES (${missed.length})`,
              onSelect: () =>
                this.scene.start("QuizReview", { missed, paper, nextWorld: hasNextWorld ? nextWorld : undefined, replay }),
            },
          ]
        : []),
      ...(hasNextWorld
        ? [
            {
              label: "NEXT WORLD",
              onSelect: () =>
                this.scene.start("Level", { paper, worldIndex: nextWorld, checkpointsCleared: 0, lives: startLives(), replay }),
            },
          ]
        : []),
      ...(result ? [{ label: "LEADERBOARD", onSelect: () => this.scene.start("Leaderboard", { paperId: paper.id }) }] : []),
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ];
    // Each option past two makes the panel grow upward.
    const extra = Math.max(items.length - 2, 0) * 36;
    const top = PANEL_TOP - extra;
    panel(this, 20, top, GAME_WIDTH - 40, 230 + extra);
    const heading = hasNextWorld ? "WORLD CLEAR!" : "PAPER COMPLETE!";
    this.add.text(GAME_WIDTH / 2, top + 32, heading, textStyle(32, NES.yellow)).setOrigin(0.5);
    showStars(this, GAME_WIDTH / 2, top + 72, stars);
    const message = hasNextWorld
      ? "You beat the boss. On to the next section of the paper!"
      : result
        ? `${result.score}/${result.total} right on the first try. Time: ${result.timeMs === null ? "- (3 stars everywhere sets one)" : formatTime(result.timeMs)}`
        : "You beat every world in this paper. Scholar status: legendary!";
    this.add.text(GAME_WIDTH / 2, top + 118, message, textStyle(16, NES.white, GAME_WIDTH - 100)).setOrigin(0.5).setAlign("center");
    new Menu(this, 280, top + 160, items);
  }

  private lose(): void {
    this.endFight();
    audio.playSfx("gameover");
    panel(this, 20, PANEL_TOP, GAME_WIDTH - 40, 230);
    this.add.text(GAME_WIDTH / 2, PANEL_TOP + 50, "GAME OVER", textStyle(32, NES.red)).setOrigin(0.5);
    new Menu(this, 280, PANEL_TOP + 110, [
      { label: "RETRY BOSS", onSelect: () => this.scene.restart({ ...this.stage, lives: startLives() }) },
      { label: "TITLE SCREEN", onSelect: () => this.scene.start("Title") },
    ]);
  }
}
