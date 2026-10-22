import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper, playablePapers } from "../content/library";
import type { Paper } from "../content/types";
import { levelMap, mapProgress, type MapStop } from "../levelMap";
import { NES, css } from "../palette";
import { loadCleared, loadProgress, loadStars, stageKey, startLives } from "../save";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, PointerGuard, showStars, textStyle } from "../ui";
import { listTop, paperLabel, shorten, tableLabels } from "./listLayout";
import { drawMenuBackdrop } from "./backdrop";

// Level select: pick a paper, then a map of its worlds where every cleared
// level (and the next one to beat) can be played again.

interface LevelSelectData {
  paperId?: string;
}

const MAP_TOP = 82;
const MAP_BOTTOM = 386;
const BOX_HEIGHT = 30;
const LEVEL_BOX_WIDTH = 72;
const BOSS_BOX_WIDTH = 88;
const BOX_GAP = 24;
// Left of center, to leave room for TOP SCHOLARS on the right.
const HINT_X = 360;
const NAME_HEIGHT = 18; // world name just above its own row of boxes, clear of the selection frame

// Colours from the game's own blocks: the next level is a gold ? block,
// cleared ones are green, and locked ones are dark, empty-looking slots.
const STATE_STYLE = {
  cleared: { fill: NES.green, text: NES.white, border: NES.lime },
  open: { fill: NES.yellow, text: NES.black, border: NES.brown },
  locked: { fill: NES.black, text: NES.gray, border: NES.gray },
} as const;

interface StopView {
  stop: MapStop;
  box: Phaser.GameObjects.Rectangle;
  stars: number; // best rating, 0 if never rated
}

export class LevelSelectScene extends Phaser.Scene {
  private rows: StopView[][] = [];
  private selected = { row: 0, column: 0 };
  private highlight!: Phaser.GameObjects.Rectangle;
  private status!: Phaser.GameObjects.Text;

  constructor() {
    super("LevelSelect");
  }

  create(data: LevelSelectData): void {
    drawMenuBackdrop(this);
    const paper = data.paperId ? findPaper(data.paperId) : undefined;
    if (paper) this.showMap(paper);
    else this.showPapers();
  }

  private showPapers(): void {
    this.add.text(GAME_WIDTH / 2, 40, "LEVEL SELECT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 80, "Replay any level you've cleared", textStyle(16, NES.sky)).setOrigin(0.5);
    const papers = playablePapers();
    const cleared = loadCleared();
    const progress = loadProgress();
    const { labels, x } = tableLabels(
      papers.map((paper) => {
        const { cleared: done, total } = mapProgress(levelMap(paper, cleared, progress));
        return [paperLabel(paper), `${done}/${total}`];
      }),
    );
    const items = papers.map((paper, i) => ({ label: labels[i], onSelect: () => this.scene.restart({ paperId: paper.id }) }));
    new Menu(this, x, listTop(items.length + 1), [...items, { label: "BACK", onSelect: () => this.scene.start("Title") }]);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));
  }

  private showMap(paper: Paper): void {
    const back = () => this.scene.restart({});
    const map = levelMap(paper, loadCleared(), loadProgress());
    const pointer = new PointerGuard(this);
    const bestStars = loadStars()[paper.id] ?? {};
    this.add.text(GAME_WIDTH / 2, 36, "LEVEL SELECT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 62, shorten(paper.title, 90), textStyle(8, NES.sky)).setOrigin(0.5);

    const rowHeight = Math.min(64, (MAP_BOTTOM - MAP_TOP) / map.length);
    this.rows = map.map((world, w) => {
      const top = MAP_TOP + w * rowHeight;
      this.add.text(GAME_WIDTH / 2, top, shorten(world.name, 44).toUpperCase(), textStyle(8, NES.lightGray)).setOrigin(0.5, 0);
      const widths = world.stops.map((stop) => (stop.stage === "boss" ? BOSS_BOX_WIDTH : LEVEL_BOX_WIDTH));
      const rowWidth = widths.reduce((sum, width) => sum + width, 0) + BOX_GAP * (widths.length - 1);
      let x = (GAME_WIDTH - rowWidth) / 2;
      const y = top + NAME_HEIGHT;
      // A path joining the boxes, drawn first so the boxes sit on top of it.
      this.add.rectangle(x, y + BOX_HEIGHT / 2, rowWidth, 4, NES.lightGray).setOrigin(0, 0.5);
      return world.stops.map((stop, column) => {
        const style = STATE_STYLE[stop.state];
        const box = this.add
          .rectangle(x, y, widths[column], BOX_HEIGHT, style.fill)
          .setOrigin(0, 0)
          .setStrokeStyle(2, style.border)
          .setInteractive({ useHandCursor: stop.state !== "locked" })
          .on("pointerdown", () => pointer.canClick && this.choose(w, column, paper));
        box.on("pointerover", () => pointer.canHover && stop.state !== "locked" && this.select(w, column));
        const label = this.add
          .text(x + widths[column] / 2, y + BOX_HEIGHT / 2, stop.label, textStyle(16, style.text))
          .setOrigin(0.5);
        if (stop.state === "open") this.tweens.add({ targets: label, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
        // Best stars sit on the box's bottom edge (levels cleared before
        // stars existed have none yet).
        const stars = bestStars[stageKey(w, stop.stage)] ?? 0;
        if (stars > 0) showStars(this, x + widths[column] / 2, y + BOX_HEIGHT, stars, 0.5);
        x += widths[column] + BOX_GAP;
        return { stop, box, stars };
      });
    });

    this.highlight = this.add.rectangle(0, 0, 10, 10).setOrigin(0, 0).setStrokeStyle(4, NES.yellow).setFillStyle();
    this.status = this.add.text(GAME_WIDTH / 2, 400, "", textStyle(8, NES.white)).setOrigin(0.5);
    // The hint sits between BACK and TOP SCHOLARS on the bottom row.
    this.add
      .text(
        HINT_X,
        420,
        isTouchDevice() ? "TAP A GREEN OR BLINKING LEVEL TO PLAY IT" : "ARROWS / WASD: CHOOSE   ENTER: PLAY",
        textStyle(8, NES.lightGray),
      )
      .setOrigin(0.5);
    const openBoard = () => this.scene.start("Leaderboard", { paperId: paper.id, back: { scene: "LevelSelect", data: { paperId: paper.id } } });
    this.add
      .text(GAME_WIDTH - 28, 414, isTouchDevice() ? "TOP SCHOLARS" : "T: TOP SCHOLARS", textStyle(16, NES.white))
      .setOrigin(1, 0.5)
      .setPadding(8, 8, 8, 8)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => pointer.canClick && openBoard());
    this.add
      .text(28, 414, "BACK", textStyle(16, NES.white))
      .setOrigin(0, 0.5)
      .setPadding(8, 8, 8, 8)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", back);

    // Start on the next level to beat, or the very last one if all are cleared.
    const all = this.rows.flat();
    const start = all.find((view) => view.stop.state === "open") ?? all[all.length - 1];
    this.select(start.stop.worldIndex, this.rows[start.stop.worldIndex].indexOf(start));

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.move(0, -1);
      else if (key === "d" || key === "arrowright") this.move(0, 1);
      else if (key === "w" || key === "arrowup") this.move(-1, 0);
      else if (key === "s" || key === "arrowdown") this.move(1, 0);
      else if (key === "enter" || key === " ") this.choose(this.selected.row, this.selected.column, paper);
      else if (key === "escape") back();
      else if (key === "t") openBoard();
      else return;
      event.preventDefault();
    });
  }

  private playable = (row: number, column: number) => this.rows[row]?.[column]?.stop.state !== "locked";

  // Moves the highlight to the nearest playable box in that direction.
  private move(rowStep: number, columnStep: number): void {
    let { row, column } = this.selected;
    if (columnStep !== 0) {
      for (let c = column + columnStep; c >= 0 && c < this.rows[row].length; c += columnStep) {
        if (this.playable(row, c)) return this.select(row, c, true);
      }
      return;
    }
    for (row += rowStep; row >= 0 && row < this.rows.length; row += rowStep) {
      // Same column if it's playable, otherwise the closest playable one.
      const options = this.rows[row].map((_, c) => c).filter((c) => this.playable(row, c));
      if (options.length === 0) continue;
      const nearest = options.reduce((best, c) => (Math.abs(c - column) < Math.abs(best - column) ? c : best));
      return this.select(row, nearest, true);
    }
  }

  private select(row: number, column: number, withSound = false): void {
    const view = this.rows[row][column];
    if (view.stop.state === "locked") return;
    if (withSound) audio.playSfx("move");
    this.selected = { row, column };
    const { x, y, width, height } = view.box;
    this.highlight.setPosition(x - 4, y - 4).setSize(width + 8, height + 8);
    const rating = view.stars > 0 ? `   ${view.stars}/3 STARS` : "";
    this.status.setColor(css(NES.white)).setText(`${view.stop.state === "open" ? "NEXT UP" : "CLEARED"}: ${view.stop.label}${rating}`);
  }

  private choose(row: number, column: number, paper: Paper): void {
    const { stop } = this.rows[row][column];
    if (stop.state === "locked") {
      audio.playSfx("wrong");
      this.status.setColor(css(NES.salmon)).setText("LOCKED: clear the levels before it first");
      return;
    }
    audio.playSfx("select");
    const world = paper.worlds[stop.worldIndex];
    const checkpointsCleared = stop.stage === "boss" ? world.cutscenes.length : stop.stage;
    this.scene.start(stop.stage === "boss" ? "Boss" : "Level", {
      paper,
      worldIndex: stop.worldIndex,
      checkpointsCleared,
      lives: startLives(),
      replay: true,
    });
  }
}
