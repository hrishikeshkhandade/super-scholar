import Phaser from "phaser";
import { audio } from "../audio/audio";
import { LIBRARY } from "../content/library";
import { NES, css } from "../palette";
import { TEXT_SPEED_MS, loadSettings, markTutorialSeen } from "../save";
import type { StageData } from "../stage";
import { isTouchDevice } from "../touchControls";
import { TUTORIAL_STEPS, lineFor, voiceFile, type TutorialPointer, type TutorialScreen } from "../tutorial";
import { GAME_HEIGHT, GAME_WIDTH, PointerGuard, panel, textStyle } from "../ui";
import { LESSON_BOX, type CutsceneData } from "./CutsceneScene";

// The professor's guided tour (the lines are in src/tutorial.ts). He pops up
// from the bottom of the screen and talks, with his words typed in a speech
// box above his head, while the real screen he's describing sits frozen
// behind him and an arrow points at the thing. Space (or a tap) shows the
// whole line, then the next one; the X in the corner ends the tour.

export interface TutorialData {
  // Where the tour goes when it ends or is closed.
  then: { scene: string; data?: object };
}

type Rect = Phaser.Geom.Rectangle;
type Side = "left" | "right" | "center";

const SCREEN_SCENES: Record<TutorialScreen, string> = { title: "Title", level: "Level", flag: "Level", lesson: "Cutscene", boss: "Boss" };

// The professor is 40x48 pixels drawn 3x, standing on the bottom edge on
// whichever side keeps him away from what he's pointing at (or in the middle).
const PROFESSOR = { scale: 3, centerFromEdge: 70, popMs: 260 };
// With nothing to point at, the box is wide enough to cover the title's sign
// whole, rather than leaving its words half hidden.
const BOX = { maxWidth: 440, wideWidth: 560, minWidth: 240, padding: 16, hintRow: 22, headGap: 20, edge: 8 };
const TARGET_PADDING = 6; // the outline's distance around what's pointed at
const TARGET_GAP = 14; // the speech box keeps at least this far from it
const ARROW = { width: 24, height: 18, gap: 6, bob: 6 };
const CLOSE = { size: 36, inset: 8 };
const DIM = 0.4; // how dark the screen gets around what's pointed at
const DIM_ALL = 0.6; // and all of it, when there's nothing to point at
const FORWARD_KEYS = [" ", "Enter", "d", "D", "ArrowRight"];
const BACK_KEYS = ["a", "A", "ArrowLeft"];

export class TutorialScene extends Phaser.Scene {
  private params!: TutorialData;
  private stepIndex = 0;
  private screenKey?: string; // the real scene frozen behind the tour
  private ending = false;
  private touch = false;
  private professor!: Phaser.GameObjects.Image;
  private side?: Side;
  private talking?: Phaser.Tweens.Tween;
  private typing?: Phaser.Time.TimerEvent;
  private voicePlaying = false;
  private body!: Phaser.GameObjects.Text;
  private hint!: Phaser.GameObjects.Text;
  private stepParts: Phaser.GameObjects.GameObject[] = [];
  // Where each part was drawn, for the play-through checks.
  layout: Record<string, Rect> = {};

  constructor() {
    super("Tutorial");
  }

  create(data: TutorialData): void {
    this.params = data;
    this.stepIndex = 0;
    this.screenKey = undefined;
    this.ending = false;
    this.side = undefined;
    this.layout = {};
    this.touch = isTouchDevice();
    this.scene.bringToTop();
    audio.setMusicDucked(true);

    this.professor = this.add.image(0, GAME_HEIGHT, "professor").setOrigin(0.5, 1).setScale(PROFESSOR.scale).setDepth(2);
    this.drawCloseButton();

    const guard = new PointerGuard(this);
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (FORWARD_KEYS.includes(event.key)) this.forward();
      else if (BACK_KEYS.includes(event.key)) this.back();
      else if (event.key === "Escape") this.end();
      else return;
      event.preventDefault();
    };
    const onClick = (_pointer: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (guard.canClick && over.length === 0) this.forward();
    };
    // From the next frame, so the press that opened the tour doesn't skip a line.
    this.time.delayedCall(0, () => {
      this.input.keyboard?.on("keydown", onKey);
      this.input.on("pointerdown", onClick);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off("keydown", onKey);
      this.input.off("pointerdown", onClick);
      audio.stopSpeaking();
      audio.setMusicDucked(false);
    });

    this.showStep(0);
  }

  private drawCloseButton(): void {
    const x = GAME_WIDTH - CLOSE.inset - CLOSE.size;
    const button = this.add
      .rectangle(x, CLOSE.inset, CLOSE.size, CLOSE.size, NES.black)
      .setOrigin(0, 0)
      .setStrokeStyle(3, NES.white)
      .setDepth(3)
      .setInteractive({ useHandCursor: true });
    const cross = this.add
      .text(x + CLOSE.size / 2, CLOSE.inset + CLOSE.size / 2, "X", textStyle(16, NES.white))
      .setOrigin(0.5)
      .setDepth(3);
    button.on("pointerover", () => cross.setColor(css(NES.yellow)));
    button.on("pointerout", () => cross.setColor(css(NES.white)));
    button.on("pointerdown", () => this.end());
    this.layout.close = button.getBounds();
  }

  private forward(): void {
    if (this.typing) this.finishTyping();
    else if (this.stepIndex < TUTORIAL_STEPS.length - 1) this.showStep(this.stepIndex + 1);
    else this.end();
  }

  private back(): void {
    if (this.stepIndex > 0) this.showStep(this.stepIndex - 1);
  }

  private showStep(index: number): void {
    this.stepIndex = index;
    this.typing?.remove();
    this.typing = undefined;
    audio.stopSpeaking();
    this.stepParts.forEach((part) => part.destroy());
    this.stepParts = [];
    this.layout = { close: this.layout.close, professor: this.layout.professor };
    const step = TUTORIAL_STEPS[index];
    // The real screen is drawn first; the step is laid out once it exists.
    this.showScreen(step.screen, (screen) => {
      if (this.stepIndex === index && !this.ending) this.drawStep(screen, step.point);
    });
  }

  // Freezes the real screen for a step behind the tour, starting it first
  // if the previous step showed a different one.
  private showScreen(screen: TutorialScreen, ready: (scene: Phaser.Scene) => void): void {
    const key = SCREEN_SCENES[screen];
    const arrange = (scene: Phaser.Scene) => {
      // The level's own camera: its start, or scrolled to the flag at its end.
      if (key === "Level") {
        const camera = scene.cameras.main.stopFollow();
        camera.setScroll(screen === "flag" ? camera.getBounds().width - GAME_WIDTH : 0, 0);
      }
      // The lesson's own professor steps aside: the tour's professor is him.
      if (key === "Cutscene") findDrawn(scene, (object) => "texture" in object && object.texture.key === "professor").forEach((object) => object.setVisible(false));
      ready(scene);
    };
    if (key === this.screenKey) {
      arrange(this.scene.get(key));
      return;
    }
    if (this.screenKey) this.scene.stop(this.screenKey);
    this.screenKey = key;
    const scene = this.scene.get(key);
    if (this.scene.isActive(key) || this.scene.isPaused(key)) {
      // Already on screen (the title, when NEW GAME started the tour).
      this.scene.pause(key);
      arrange(scene);
      return;
    }
    scene.events.once(Phaser.Scenes.Events.CREATE, () => {
      // Every screen fades in from black, but a frozen one never would.
      scene.cameras.main.resetFX();
      scene.scene.pause();
      arrange(scene);
    });
    this.scene.launch(key, screenData(screen));
  }

  private drawStep(screen: Phaser.Scene, point: TutorialPointer | undefined): void {
    const target = point && findTarget(screen, point);
    const zone = target && insideScreen(Phaser.Geom.Rectangle.Inflate(Phaser.Geom.Rectangle.Clone(target), TARGET_PADDING, TARGET_PADDING));
    // The professor stands on the side away from what he's pointing at.
    const step = TUTORIAL_STEPS[this.stepIndex];
    const away = !zone || zone.centerX >= GAME_WIDTH / 2 ? "left" : "right";
    const side: Side = this.touch && step.touchStandsCenter ? "center" : away;
    this.dimAround(zone);
    const arrow = zone && this.drawPointer(zone, away);
    // Everything near what's pointed at: the speech box keeps clear of it.
    const keepClear = zone && Phaser.Geom.Rectangle.Union(zone, arrow!);

    this.moveProfessor(side);
    const line = lineFor(step, this.touch);
    this.drawSpeechBox(side, line.text, keepClear);

    this.voicePlaying = audio.speak(`${import.meta.env.BASE_URL}${voiceFile(line.id)}`, () => {
      this.voicePlaying = false;
      if (!this.typing) this.stopTalking();
    });
    this.startTalking();
    this.typeLine(line.text);
  }

  // Darkens the screen except a window around what's pointed at (all of
  // it, a little more, when there's nothing to point at).
  private dimAround(zone: Rect | undefined): void {
    const shade = (x: number, y: number, width: number, height: number, alpha = DIM) =>
      this.stepParts.push(this.add.rectangle(x, y, width, height, NES.black, alpha).setOrigin(0, 0));
    if (!zone) {
      shade(0, 0, GAME_WIDTH, GAME_HEIGHT, DIM_ALL);
      return;
    }
    shade(0, 0, GAME_WIDTH, zone.top);
    shade(0, zone.bottom, GAME_WIDTH, GAME_HEIGHT - zone.bottom);
    shade(0, zone.top, zone.left, zone.height);
    shade(zone.right, zone.top, GAME_WIDTH - zone.right, zone.height);
  }

  // A yellow outline around the thing, and an arrow beside it pointing in,
  // on the side away from the professor (so it never lands on a neighbor in
  // a list), or the other side if there's no room.
  private drawPointer(zone: Rect, professorSide: "left" | "right"): Rect {
    const outline = this.add.rectangle(zone.x, zone.y, zone.width, zone.height).setOrigin(0, 0).setStrokeStyle(3, NES.yellow);
    const reach = ARROW.gap + ARROW.height + ARROW.bob;
    const fitsLeft = zone.left - reach >= CLOSE.inset;
    const fitsRight = zone.right + reach <= GAME_WIDTH - CLOSE.inset;
    const onLeft = professorSide === "right" ? fitsLeft || !fitsRight : !fitsRight;
    const tipX = onLeft ? zone.left - ARROW.gap : zone.right + ARROW.gap;
    const baseX = onLeft ? tipX - ARROW.height : tipX + ARROW.height;
    const half = ARROW.width / 2;
    const y = zone.centerY;
    const arrow = this.add
      .graphics()
      .fillStyle(NES.yellow)
      .lineStyle(2, NES.black)
      .fillTriangle(baseX, y - half, baseX, y + half, tipX, y)
      .strokeTriangle(baseX, y - half, baseX, y + half, tipX, y);
    // It bobs away from the thing and back, never into it.
    this.tweens.add({ targets: arrow, x: onLeft ? -ARROW.bob : ARROW.bob, duration: 350, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    this.stepParts.push(outline, arrow);
    const left = onLeft ? baseX - ARROW.bob : tipX;
    const arrowArea = new Phaser.Geom.Rectangle(left, y - half, ARROW.height + ARROW.bob, ARROW.width);
    this.layout.outline = outline.getBounds();
    this.layout.arrow = arrowArea;
    return arrowArea;
  }

  // Pops up from the bottom edge, or ducks down and comes up on the other side.
  private moveProfessor(side: Side): void {
    if (side === this.side) return;
    const x = standingX(side);
    const hidden = GAME_HEIGHT + this.professor.displayHeight;
    this.tweens.killTweensOf(this.professor);
    const popUp = () => {
      this.professor.setPosition(x, hidden).setFlipX(side === "right");
      this.tweens.add({ targets: this.professor, y: GAME_HEIGHT, duration: PROFESSOR.popMs, ease: "Back.easeOut" });
    };
    if (this.side) this.tweens.add({ targets: this.professor, y: hidden, duration: PROFESSOR.popMs / 2, onComplete: popUp });
    else popUp();
    this.side = side;
    this.layout.professor = new Phaser.Geom.Rectangle(
      x - this.professor.displayWidth / 2,
      GAME_HEIGHT - this.professor.displayHeight,
      this.professor.displayWidth,
      this.professor.displayHeight,
    );
  }

  // He bobs while he talks: a little stretch upward from his feet, which
  // leaves his position to the pop-up.
  private startTalking(): void {
    this.stopTalking();
    this.talking = this.tweens.add({ targets: this.professor, scaleY: PROFESSOR.scale * 1.03, duration: 140, yoyo: true, repeat: -1 });
  }

  private stopTalking(): void {
    this.talking?.remove();
    this.talking = undefined;
    this.professor.setScale(PROFESSOR.scale);
  }

  // As wide as it can be without covering what's pointed at, sitting above
  // the professor's head with a tail down to him.
  private drawSpeechBox(side: Side, text: string, keepClear: Rect | undefined): void {
    const bottom = GAME_HEIGHT - this.professor.displayHeight - BOX.headGap;
    const measure = this.add.text(0, 0, text, textStyle(16, NES.white, 1));
    const boxFor = (width: number) => {
      measure.setWordWrapWidth(width - BOX.padding * 2);
      const height = BOX.padding * 2 + measure.height + BOX.hintRow;
      const x = side === "left" ? BOX.edge : side === "right" ? GAME_WIDTH - BOX.edge - width : (GAME_WIDTH - width) / 2;
      return new Phaser.Geom.Rectangle(x, bottom - height, width, height);
    };
    let rect = boxFor(keepClear ? BOX.maxWidth : BOX.wideWidth);
    if (keepClear && side !== "center" && Phaser.Geom.Intersects.RectangleToRectangle(rect, keepClear)) {
      const room = side === "left" ? keepClear.left - TARGET_GAP - BOX.edge : GAME_WIDTH - BOX.edge - keepClear.right - TARGET_GAP;
      rect = boxFor(Phaser.Math.Clamp(room, BOX.minWidth, BOX.maxWidth));
    }
    measure.destroy();

    const tailX = standingX(side);
    const tipY = bottom + BOX.headGap - 6;
    const tail = this.add
      .graphics()
      .fillStyle(NES.black)
      .lineStyle(4, NES.white)
      .fillTriangle(tailX - 12, rect.bottom - 2, tailX + 12, rect.bottom - 2, tailX, tipY)
      .strokeTriangle(tailX - 12, rect.bottom - 2, tailX + 12, rect.bottom - 2, tailX, tipY);
    const box = panel(this, rect.x, rect.y, rect.width, rect.height);
    // Covers the tail's top edge, so the box and tail read as one outline.
    const join = this.add.rectangle(tailX, rect.bottom - 2, 18, 6, NES.black);
    this.body = this.add.text(rect.x + BOX.padding, rect.y + BOX.padding, "", textStyle(16, NES.white, rect.width - BOX.padding * 2));
    const counter = this.add
      .text(rect.x + BOX.padding, rect.bottom - 10, `${this.stepIndex + 1}/${TUTORIAL_STEPS.length}`, textStyle(8, NES.lightGray))
      .setOrigin(0, 1);
    this.hint = this.add.text(rect.right - BOX.padding, rect.bottom - 10, "", textStyle(8, NES.yellow)).setOrigin(1, 1);
    this.tweens.add({ targets: this.hint, alpha: 0.3, duration: 400, yoyo: true, repeat: -1 });
    this.stepParts.push(tail, box, join, this.body, counter, this.hint);
    this.layout.box = rect;
    this.layout.tail = new Phaser.Geom.Rectangle(tailX - 14, rect.bottom, 28, tipY - rect.bottom + 2);
  }

  private typeLine(text: string): void {
    this.hint.setText(this.touch ? "TAP: SHOW ALL" : "SPACE: SHOW ALL");
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: TEXT_SPEED_MS[loadSettings().textSpeed],
      repeat: text.length - 1,
      callback: () => {
        shown += 1;
        this.body.setText(text.slice(0, shown));
        if (shown >= text.length) this.finishTyping();
      },
    });
  }

  private finishTyping(): void {
    this.typing?.remove();
    this.typing = undefined;
    this.body.setText(lineFor(TUTORIAL_STEPS[this.stepIndex], this.touch).text);
    if (!this.voicePlaying) this.stopTalking();
    const last = this.stepIndex === TUTORIAL_STEPS.length - 1;
    const next = last ? "DONE" : "NEXT";
    const back = this.stepIndex > 0 && !this.touch ? "A: BACK  " : "";
    this.hint.setText(`${back}${this.touch ? "TAP" : "SPACE"}: ${next}`);
  }

  // The tour is over (finished or closed): it won't start by itself again.
  private end(): void {
    if (this.ending) return;
    this.ending = true;
    markTutorialSeen();
    if (this.screenKey) this.scene.stop(this.screenKey);
    const { then } = this.params;
    this.scene.start(then.scene, then.data);
  }
}

// Where the professor stands, across the bottom of the screen.
function standingX(side: Side): number {
  if (side === "center") return GAME_WIDTH / 2;
  return side === "left" ? PROFESSOR.centerFromEdge : GAME_WIDTH - PROFESSOR.centerFromEdge;
}

// The data each real screen starts with: the first built-in paper's first
// level, lesson, and boss, frozen before anything moves.
function screenData(screen: TutorialScreen): object {
  const paper = LIBRARY[0];
  const stage: StageData = { paper, worldIndex: 0, checkpointsCleared: 0, lives: 3, replay: true, preview: true };
  if (screen === "lesson") {
    const lesson: CutsceneData = { cutscene: paper.worlds[0].cutscenes[0], lives: 3, preview: true };
    return lesson;
  }
  return screen === "title" ? {} : stage;
}

type Drawn = Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text;

// The pictures and texts on a screen that pass a test.
function findDrawn(screen: Phaser.Scene, test: (object: Drawn) => boolean): Drawn[] {
  const isDrawn = (object: Phaser.GameObjects.GameObject): object is Drawn =>
    object instanceof Phaser.GameObjects.Image || object instanceof Phaser.GameObjects.Sprite || object instanceof Phaser.GameObjects.Text;
  return screen.children.list.filter(isDrawn).filter(test);
}

// A rectangle trimmed to the screen, so an outline never runs off its edge.
function insideScreen(rect: Rect): Rect {
  const edge = 2;
  const left = Math.max(rect.left, edge);
  const top = Math.max(rect.top, edge);
  return new Phaser.Geom.Rectangle(left, top, Math.min(rect.right, GAME_WIDTH - edge) - left, Math.min(rect.bottom, GAME_HEIGHT - edge) - top);
}

// Where a pointer's thing is on the screen right now (everything matching,
// as one area), or undefined if none of it is in view.
function findTarget(screen: Phaser.Scene, point: TutorialPointer): Rect | undefined {
  // The lesson box, with its speaker's name tag sitting on its top edge.
  if ("named" in point) return new Phaser.Geom.Rectangle(LESSON_BOX.x, LESSON_BOX.y - 16, LESSON_BOX.width, LESSON_BOX.height + 16);
  const camera = screen.cameras.main;
  const view = new Phaser.Geom.Rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT);
  const textures = "texture" in point ? [point.texture].flat() : [];
  const matches = findDrawn(screen, (object) => {
    if (!object.visible) return false;
    return "label" in point ? object instanceof Phaser.GameObjects.Text && object.text.startsWith(point.label) : textures.includes(object.texture.key);
  });
  const areas = matches
    .map((object) => {
      const bounds = object.getBounds();
      bounds.x -= camera.scrollX * object.scrollFactorX;
      bounds.y -= camera.scrollY * object.scrollFactorY;
      return bounds;
    })
    .filter((bounds) => Phaser.Geom.Intersects.RectangleToRectangle(bounds, view));
  if ("label" in point) return areas[0];
  return areas.reduce<Rect | undefined>((all, area) => (all ? Phaser.Geom.Rectangle.Union(all, area) : area), undefined);
}
