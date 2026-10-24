import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper, playablePapers } from "../content/library";
import type { Paper } from "../content/types";
import { showOverGame } from "../htmlOverlay";
import { MAX_NAME_CHARS, formatTime, nicknameProblem, type BoardEntry } from "../leaderboard";
import { NES, css } from "../palette";
import { endRun, finishedRun, runResult, type RunResult } from "../run";
import { isTouchDevice } from "../touchControls";
import { loadProgress } from "../save";
import { GAME_WIDTH, Menu, PointerGuard, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";
import { noLigatures, shorten } from "./listLayout";

// TOP SCHOLARS: a paper's top 10, ranked by quiz answers right on the first
// try, then time. After finishing a full run, the player can add their score.
// The < > arrows (or A/D) flip through every paper's board.

export interface LeaderboardData {
  // The paper to show first: the one played last if not given.
  paperId?: string;
  // Where BACK goes (the title screen if not given).
  back?: { scene: string; data?: object };
}

// Taller on phones, where the box has bigger text and finger-sized buttons.
const formBox = () => ({ x: 150, y: 96, width: GAME_WIDTH - 300, height: isTouchDevice() ? 52 : 40 });
const TABLE_X = 136;
// Rows sit a little closer when the nickname box takes room above them, so
// a full board still clears the legend.
const ROW_HEIGHT = { roomy: 22, compact: 19 };
const BACK_Y = 404;
const SWITCHER_Y = 62;
const SWITCHER_ARROW_GAP = 22;
const LEGEND = "SCORE: quiz answers right on the first try.  TIME: only with 3 stars on every level.";

// "  1  Adhi          23/26   12:34", in the monospace pixel font.
function row(place: string, name: string, score: string, time: string): string {
  return noLigatures(`${place.padStart(3)}  ${name.padEnd(MAX_NAME_CHARS)}  ${score.padStart(7)}  ${time.padStart(7)}`);
}

export class LeaderboardScene extends Phaser.Scene {
  private paper!: Paper;
  private result?: RunResult;
  private message!: Phaser.GameObjects.Text;
  private rows: Phaser.GameObjects.Text[] = [];
  private tableTop = 0;
  private rowHeight = ROW_HEIGHT.roomy;
  private sending = false;
  private status?: Phaser.GameObjects.Text; // under the nickname box

  constructor() {
    super("Leaderboard");
  }

  create(data: LeaderboardData): void {
    const papers = playablePapers();
    const lastPlayed = loadProgress()?.paperId;
    const paper = findPaper(data.paperId ?? lastPlayed ?? "") ?? papers[0];
    const back = () => this.scene.start(data.back?.scene ?? "Title", data.back?.data);
    drawMenuBackdrop(this);
    this.rows = [];
    this.sending = false;
    if (!paper) {
      back();
      return;
    }
    this.paper = paper;
    this.addPaperSwitcher(papers, data);
    const run = finishedRun(paper.id);
    this.result = run && runResult(paper, run);

    this.add.text(GAME_WIDTH / 2, 36, "TOP SCHOLARS", textStyle(24, NES.yellow)).setOrigin(0.5);
    // A finished run gets the nickname box above the table.
    this.tableTop = this.result ? formBox().y + formBox().height + 22 : 100;
    this.rowHeight = this.result ? ROW_HEIGHT.compact : ROW_HEIGHT.roomy;
    if (this.result) this.showSubmitForm(this.result);
    this.message = this.add.text(GAME_WIDTH / 2, this.tableTop + 130, "", textStyle(16, NES.lightGray, GAME_WIDTH - 120)).setOrigin(0.5).setAlign("center");
    this.add.text(TABLE_X, this.tableTop, row("#", "NAME", "SCORE", "TIME"), textStyle(16, NES.gray));

    this.add.text(GAME_WIDTH / 2, BACK_Y - 22, LEGEND, textStyle(8, NES.lightGray)).setOrigin(0.5);
    new Menu(this, GAME_WIDTH / 2 - 32, BACK_Y, [{ label: "BACK", onSelect: back }]);
    this.input.keyboard?.on("keydown-ESC", back);
    void this.loadBoard();
  }

  // "<  Paper title  (2/7)  >": flips to the previous or next paper's board.
  private addPaperSwitcher(papers: Paper[], data: LeaderboardData): void {
    const index = Math.max(papers.findIndex((other) => other.id === this.paper.id), 0);
    const label = papers.length > 1 ? `${shorten(this.paper.title, 70)}  (${index + 1}/${papers.length})` : shorten(this.paper.title, 80);
    const title = this.add.text(GAME_WIDTH / 2, SWITCHER_Y, label, textStyle(8, NES.sky)).setOrigin(0.5);
    if (papers.length < 2) return;
    const flip = (step: number) => {
      audio.playSfx("move");
      const next = papers[(index + step + papers.length) % papers.length];
      this.scene.restart({ ...data, paperId: next.id });
    };
    const pointer = new PointerGuard(this);
    // Right beside the paper's name, so they read as "other papers".
    const arrows = [
      [title.getBounds().left - SWITCHER_ARROW_GAP, "<", -1],
      [title.getBounds().right + SWITCHER_ARROW_GAP, ">", 1],
    ] as const;
    for (const [x, text, step] of arrows) {
      this.add
        .text(x, SWITCHER_Y, text, textStyle(16, NES.yellow))
        .setOrigin(0.5)
        .setPadding(16, 14, 16, 14) // a fingertip-sized target on phones
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => pointer.canClick && flip(step));
    }
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") flip(-1);
      else if (key === "d" || key === "arrowright") flip(1);
    });
  }

  private async loadBoard(): Promise<void> {
    this.message.setText("Loading scores...");
    try {
      const response = await fetch(`/api/leaderboard?paper=${encodeURIComponent(this.paper.id)}`);
      if (!response.ok) throw new Error(String(response.status));
      const { entries } = (await response.json()) as { entries: BoardEntry[] };
      if (this.scene.isActive()) this.showBoard(entries);
    } catch {
      if (this.scene.isActive()) this.message.setColor(css(NES.salmon)).setText("Couldn't load the scores. Check your connection.");
    }
  }

  private showBoard(entries: BoardEntry[], highlight = 0): void {
    this.rows.forEach((text) => text.destroy());
    this.message.setText("");
    if (entries.length === 0) {
      this.message.setColor(css(NES.lightGray)).setText(this.result ? "No scores yet. Add yours and be the first!" : "No scores yet. Finish this paper to be the first!");
      return;
    }
    this.rows = entries.map((entry, i) =>
      this.add.text(
        TABLE_X,
        this.tableTop + this.rowHeight * (i + 1),
        row(String(i + 1), entry.name, `${entry.score}/${entry.total}`, formatTime(entry.timeMs)),
        textStyle(16, i + 1 === highlight ? NES.yellow : NES.white),
      ),
    );
  }

  // The finished run's result, and a box for a nickname to put it on the board.
  private showSubmitForm(result: RunResult): void {
    const time = result.timeMs === null ? "no time (3 stars everywhere sets one)" : `time ${formatTime(result.timeMs)}`;
    this.add
      .text(GAME_WIDTH / 2, 86, `YOUR RUN: ${result.score}/${result.total} right first try, ${time}`, textStyle(8, NES.lime))
      .setOrigin(0.5);
    const form = document.getElementById("board-form") as HTMLFormElement;
    const input = form.elements.namedItem("nickname") as HTMLInputElement;
    const send = document.getElementById("board-send") as HTMLButtonElement;
    form.reset();
    send.disabled = false;
    const submit = () => void this.submit(input, send, form);
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      } else if (event.key === "Escape") {
        input.blur();
        return; // let Esc reach the game, which goes back
      }
      event.stopPropagation(); // typed letters shouldn't move the menu
    };
    const onSubmit = (event: Event) => event.preventDefault();
    send.addEventListener("click", submit);
    form.addEventListener("keydown", onKey);
    form.addEventListener("submit", onSubmit);
    const box = formBox();
    showOverGame(this, form, box);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      send.removeEventListener("click", submit);
      form.removeEventListener("keydown", onKey);
      form.removeEventListener("submit", onSubmit);
    });
    this.status = this.add.text(GAME_WIDTH / 2, box.y + box.height + 6, "", textStyle(8, NES.lightGray)).setOrigin(0.5, 0);
    input.focus();
  }

  private async submit(input: HTMLInputElement, send: HTMLButtonElement, form: HTMLFormElement): Promise<void> {
    if (this.sending || !this.result) return;
    const name = input.value.trim();
    const problem = nicknameProblem(name);
    if (problem) {
      audio.playSfx("wrong");
      this.status?.setColor(css(NES.salmon)).setText(problem);
      return;
    }
    this.sending = true;
    send.disabled = true;
    this.status?.setColor(css(NES.lightGray)).setText("Adding your score...");
    const response = await fetch("/api/leaderboard", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ paperId: this.paper.id, name, ...this.result }),
    }).catch(() => undefined);
    if (!this.scene.isActive()) return;
    if (!response?.ok) {
      audio.playSfx("wrong");
      const problem = !response
        ? "Couldn't add your score. Check your connection."
        : response.status === 429
          ? "Too many tries. Wait a minute and try again."
          : "Couldn't add your score. Try again in a moment.";
      this.status?.setColor(css(NES.salmon)).setText(problem);
      send.disabled = false;
      this.sending = false;
      return;
    }
    const { entries, place } = (await response.json()) as { entries: BoardEntry[]; place: number };
    endRun(); // on the board now, so it can't be added twice
    audio.playSfx("powerup");
    form.hidden = true;
    this.status?.setColor(css(NES.lime)).setText(place > 0 ? `You're #${place}! Nice studying.` : "Not in the top 10 this time. Keep studying!");
    this.showBoard(entries, place);
  }
}
