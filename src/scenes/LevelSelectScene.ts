import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper, playablePapers } from "../content/library";
import type { Paper } from "../content/types";
import { levelMap, mapProgress, type MapStop } from "../levelMap";
import { NES, css } from "../palette";
import { loadCleared, loadProgress } from "../save";
import { isTouchDevice } from "../touchControls";
import { GAME_WIDTH, Menu, START_LIVES, textStyle } from "../ui";
import { listTop, paperLabel, shorten, tableLabels } from "./listLayout";

// Level select: pick a paper, then a map of its worlds where every cleared
// level (and the next one to beat) can be played again.

interface LevelSelectData {
  paperId?: string;
}

const MAP_TOP = 76;
const MAP_BOTTOM = 392;
const BOX_HEIGHT = 30;
const LEVEL_BOX_WIDTH = 72;
const BOSS_BOX_WIDTH = 88;
const BOX_GAP = 24;
const NAME_HEIGHT = 14; // world name just above its own row of boxes

const STATE_STYLE = {
  cleared: { fill: NES.green, text: NES.white, border: NES.white },
  open: { fill: NES.black, text: NES.yellow, border: NES.yellow },
  locked: { fill: NES.navy, text: NES.gray, border: NES.gray },
} as const;

interface StopView {
  stop: MapStop;
  box: Phaser.GameObjects.Rectangle;
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
    this.cameras.main.setBackgroundColor(NES.navy);
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
    this.add.text(GAME_WIDTH / 2, 22, "LEVEL SELECT", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 52, shorten(paper.title, 90), textStyle(8, NES.sky)).setOrigin(0.5);

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
          .on("pointerdown", () => this.choose(w, column, paper));
        box.on("pointerover", () => stop.state !== "locked" && this.select(w, column));
        const label = this.add
          .text(x + widths[column] / 2, y + BOX_HEIGHT / 2, stop.label, textStyle(16, style.text))
          .setOrigin(0.5);
        if (stop.state === "open") this.tweens.add({ targets: label, alpha: 0.3, duration: 500, yoyo: true, repeat: -1 });
        x += widths[column] + BOX_GAP;
        return { stop, box };
      });
    });

    this.highlight = this.add.rectangle(0, 0, 10, 10).setOrigin(0, 0).setStrokeStyle(4, NES.yellow).setFillStyle();
    this.status = this.add.text(GAME_WIDTH / 2, 404, "", textStyle(8, NES.white)).setOrigin(0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        426,
        isTouchDevice() ? "TAP A GREEN OR BLINKING LEVEL TO PLAY IT" : "ARROWS / WASD: CHOOSE   ENTER: PLAY   ESC: BACK",
        textStyle(8, NES.lightGray),
      )
      .setOrigin(0.5);
    this.add
      .text(28, 426, "BACK", textStyle(16, NES.white))
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
    this.highlight.setPosition(x - 5, y - 5).setSize(width + 10, height + 10);
    this.status.setColor(css(NES.white)).setText(`${view.stop.state === "open" ? "NEXT UP" : "CLEARED"}: ${view.stop.label}`);
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
      lives: START_LIVES,
    });
  }
}
