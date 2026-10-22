import Phaser from "phaser";
import { audio } from "../audio/audio";
import { LIBRARY, searchPapers } from "../content/library";
import { searchOnline, type OnlinePaper } from "../content/openAlex";
import type { Paper } from "../content/types";
import { startPaperOver } from "../levelMap";
import { startLives } from "../save";
import { NES, css } from "../palette";
import { GAME_WIDTH, Menu, textStyle } from "../ui";
import { drawMenuBackdrop } from "./backdrop";

const INPUT_BOX = { x: 40, y: 64, width: GAME_WIDTH - 80, height: 40 };
const SEARCH_DELAY_MS = 500; // wait for a pause in typing before searching online
const MIN_ONLINE_QUERY = 3;
const LINE_CHARS = 40;
// The list's height budget between UPLOAD and BACK: ready papers take one
// line each, online results two, so as many as fit are shown.
const LIST_ROOM = 208;
const ONE_LINE_ROW = 30;
const TWO_LINE_ROW = 56;
export const LAST_QUERY_KEY = "lastSearchQuery";

function truncate(text: string, length: number): string {
  return text.length <= length ? text : `${text.slice(0, length - 3).trimEnd()}...`;
}

// "Horowitz & Teukolsky (1999)": last names only, so the year still fits on the line.
function byline(authors: string[], year: number | undefined): string {
  const lastNames = authors.map((name) => name.trim().split(/\s+/).pop()!);
  const names =
    lastNames.length === 0
      ? "Unknown authors"
      : lastNames.length > 2
        ? `${lastNames[0]} et al.`
        : lastNames.join(" & ");
  return year ? `${names} (${year})` : names;
}

export class PaperSelectScene extends Phaser.Scene {
  private searchInput!: HTMLInputElement;
  private menu!: Menu;
  private status!: Phaser.GameObjects.Text;
  private localResults: Paper[] = [];
  private onlineResults: OnlinePaper[] = [];
  private searchTimer?: Phaser.Time.TimerEvent;
  private searchAbort?: AbortController;

  constructor() {
    super("PaperSelect");
  }

  create(): void {
    drawMenuBackdrop(this);
    audio.playMusic("title");
    this.add.text(GAME_WIDTH / 2, 36, "CHOOSE A PAPER", textStyle(24, NES.yellow)).setOrigin(0.5);
    this.status = this.add.text(40, 114, "", textStyle(8, NES.lightGray));
    this.localResults = [];
    this.onlineResults = [];
    this.menu = new Menu(this, 72, 136, [], { size: 16, spacing: 14 });

    this.searchInput = document.getElementById("search-input") as HTMLInputElement;
    // Coming back from a paper's details keeps the previous search.
    const lastQuery = (this.registry.get(LAST_QUERY_KEY) as string | undefined) ?? "";
    this.searchInput.value = lastQuery;
    this.searchInput.hidden = false;
    this.positionInput();
    this.searchInput.focus();

    const onType = () => this.onQueryChanged(this.searchInput.value);
    const onResize = () => this.positionInput();
    this.searchInput.addEventListener("input", onType);
    this.scale.on(Phaser.Scale.Events.RESIZE, onResize);
    window.addEventListener("resize", onResize);
    this.input.keyboard?.on("keydown-ESC", () => this.scene.start("Title"));

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.searchInput.hidden = true;
      this.searchInput.blur();
      this.searchInput.removeEventListener("input", onType);
      window.removeEventListener("resize", onResize);
      this.scale.off(Phaser.Scale.Events.RESIZE, onResize);
      this.searchAbort?.abort();
    });

    this.onQueryChanged(lastQuery);
  }

  // Built-in papers filter instantly as you type; the online database is
  // searched once typing pauses, so each keystroke doesn't cost a request.
  // The browser's file picker; picking a PDF starts building a game from it.
  private chooseUpload(): void {
    const picker = document.getElementById("pdf-input") as HTMLInputElement;
    picker.value = "";
    picker.onchange = () => {
      const file = picker.files?.[0];
      if (file && this.scene.isActive()) this.scene.start("Generate", { file });
    };
    picker.click();
  }

  private onQueryChanged(query: string): void {
    this.registry.set(LAST_QUERY_KEY, query);
    this.localResults = searchPapers(query);
    this.onlineResults = [];
    this.searchTimer?.remove();
    this.searchAbort?.abort();
    if (query.trim().length < MIN_ONLINE_QUERY) {
      this.status.setText("Type a topic to search 250 million papers (OpenAlex)").setColor(css(NES.lightGray));
    } else {
      this.status.setText("Searching...").setColor(css(NES.yellow));
      this.searchTimer = this.time.delayedCall(SEARCH_DELAY_MS, () => void this.runOnlineSearch(query));
    }
    this.showResults();
  }

  private async runOnlineSearch(query: string): Promise<void> {
    const abort = new AbortController();
    this.searchAbort = abort;
    try {
      this.onlineResults = await searchOnline(query, abort.signal);
      if (abort.signal.aborted || !this.scene.isActive()) return;
      const found = this.localResults.length + this.onlineResults.length;
      this.status
        .setText(found === 0 ? "No papers found. Try different words." : "")
        .setColor(css(found === 0 ? NES.salmon : NES.lightGray));
      this.showResults();
    } catch {
      if (abort.signal.aborted || !this.scene.isActive()) return;
      this.status.setText("Couldn't reach the paper database. Check your connection.").setColor(css(NES.salmon));
    }
  }

  private showResults(): void {
    const ready = this.localResults.slice(0, Math.floor(LIST_ROOM / ONE_LINE_ROW));
    const onlineRoom = Math.floor((LIST_ROOM - ready.length * ONE_LINE_ROW) / TWO_LINE_ROW);
    this.menu.setItems([
      { label: "+ UPLOAD A PDF\n  Turn any paper into a game", onSelect: () => this.chooseUpload() },
      ...ready.map((paper) => ({
        // Ready-to-play papers (built in or uploaded) fit on one line each.
        label: `* ${truncate(paper.title, LINE_CHARS - 10)} ${LIBRARY.includes(paper) ? "- READY" : "(UPLOAD)"}`,
        onSelect: () => this.startPaper(paper),
      })),
      ...this.onlineResults.slice(0, onlineRoom).map((paper) => ({
        // "FREE PDF" up front means it can be played right away. The second
        // line is indented, like UPLOAD's, so each result reads as one block.
        label: `${truncate(paper.title, LINE_CHARS)}\n  ${truncate(`${paper.pdfUrl ? "FREE PDF - " : ""}${byline(paper.authors, paper.year)}`, LINE_CHARS - 2)}`,
        onSelect: () => this.scene.start("PaperDetail", { paper }),
      })),
      { label: "BACK", onSelect: () => this.scene.start("Title") },
    ]);
  }

  private startPaper(paper: Paper): void {
    startPaperOver(paper);
    this.scene.start("Cutscene", {
      cutscene: paper.intro,
      lives: startLives(),
      next: { scene: "Level", data: { paper, worldIndex: 0, checkpointsCleared: 0 } },
    });
  }

  // The search box is a real HTML input laid over the canvas, so it gets
  // native typing, paste, and the phone keyboard. Match it to the canvas scale.
  private positionInput(): void {
    const canvas = this.game.canvas.getBoundingClientRect();
    const container = this.searchInput.parentElement!.getBoundingClientRect();
    const scale = canvas.width / GAME_WIDTH;
    Object.assign(this.searchInput.style, {
      left: `${canvas.left - container.left + INPUT_BOX.x * scale}px`,
      top: `${canvas.top - container.top + INPUT_BOX.y * scale}px`,
      width: `${INPUT_BOX.width * scale}px`,
      height: `${INPUT_BOX.height * scale}px`,
      fontSize: `${Math.max(12, 16 * scale)}px`,
      borderWidth: `${Math.max(2, 4 * scale)}px`,
    });
  }
}
