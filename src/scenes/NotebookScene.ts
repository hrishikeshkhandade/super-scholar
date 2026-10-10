import Phaser from "phaser";
import { audio } from "../audio/audio";
import { LIBRARY, findPaper, playablePapers } from "../content/library";
import type { Paper } from "../content/types";
import { paperProgress, progressOf, worldSections, type NotePage, type NoteSection } from "../notebook";
import { NES, css } from "../palette";
import { loadNotebook, type Notebook } from "../save";
import { GAME_WIDTH, Menu, fitTextToHeight, panel, textStyle } from "../ui";

// The Scholar's Notebook: review every lesson, fun fact, and question
// unlocked so far. Three views in one scene: papers, then a paper's worlds,
// then one world's LESSONS / FACTS / CARDS.

interface NotebookData {
  paperId?: string;
  worldIndex?: number;
}

const MAX_TITLE_CHARS = 26;
const PAGE_BOX = { x: 20, y: 68, width: GAME_WIDTH - 40, height: 324 };
const CHOICE_LETTERS = ["A", "B", "C", "D", "E", "F"];

const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);
const fraction = ({ unlocked, total }: { unlocked: number; total: number }) => `${unlocked}/${total}`;

// The pixel font is monospace, so padding names with spaces lines the counts
// up in one column. Returns the labels and the x that centers the block.
const CHAR_WIDTH = 16;
const CURSOR_SPACE = 28; // the menu's ">" sits this far left of the labels
const ROW_HEIGHT = 36; // a 16px menu option plus its spacing
const LIST_AREA = { top: 110, bottom: 430 }; // the space under the heading

// The y that centers a list of this many options in the space under the heading.
const listTop = (options: number) =>
  Math.max(LIST_AREA.top, Math.round((LIST_AREA.top + LIST_AREA.bottom - options * ROW_HEIGHT) / 2));
function tableLabels(rows: [string, string][]): { labels: string[]; x: number } {
  const nameWidth = Math.max(...rows.map(([name]) => name.length));
  const countWidth = Math.max(...rows.map(([, count]) => count.length));
  const labels = rows.map(([name, count]) => `${name.padEnd(nameWidth)}  ${count.padStart(countWidth)}`);
  const blockWidth = (nameWidth + 2 + countWidth) * CHAR_WIDTH + CURSOR_SPACE;
  return { labels, x: Math.round((GAME_WIDTH - blockWidth) / 2) + CURSOR_SPACE };
}

export class NotebookScene extends Phaser.Scene {
  private notebook: Notebook = {};
  private sections: NoteSection[] = [];
  private sectionIndex = 0;
  private pageIndex = 0;
  private flipped = false;
  private tabs: Phaser.GameObjects.Text[] = [];
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private counter!: Phaser.GameObjects.Text;
  private flipHint!: Phaser.GameObjects.Text;

  constructor() {
    super("Notebook");
  }

  create(data: NotebookData): void {
    this.cameras.main.setBackgroundColor(NES.navy);
    this.notebook = loadNotebook();
    const paper = data.paperId ? findPaper(data.paperId) : undefined;
    if (paper && data.worldIndex !== undefined && paper.worlds[data.worldIndex]) {
      this.showWorld(paper, data.worldIndex);
    } else if (paper) {
      this.showWorlds(paper);
    } else {
      this.showPapers();
    }
  }

  private heading(text: string, subtitle: string): void {
    this.add.text(GAME_WIDTH / 2, 40, text, textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 80, subtitle, textStyle(16, NES.sky)).setOrigin(0.5);
  }

  private onEsc(action: () => void): void {
    this.input.keyboard?.on("keydown-ESC", action);
  }

  private showPapers(): void {
    this.heading("SCHOLAR'S NOTEBOOK", "Everything you've unlocked, to review");
    // Uploads are tagged, since an upload can share a title with a built-in paper.
    const papers = playablePapers();
    const { labels, x } = tableLabels(
      papers.map((paper) => [
        `${shorten(paper.title, MAX_TITLE_CHARS)}${LIBRARY.includes(paper) ? "" : " (UPLOAD)"}`,
        fraction(paperProgress(paper, this.notebook)),
      ]),
    );
    const items = papers.map((paper, i) => ({
      label: labels[i],
      onSelect: () => this.scene.restart({ paperId: paper.id }),
    }));
    const menu = new Menu(this, x, listTop(items.length + 2), [...items, { label: "BACK", onSelect: () => this.scene.start("Title") }]);
    this.add
      .text(GAME_WIDTH / 2, menu.bottom + 30, "Clear levels, stomp bears, and face bosses to fill it in.", textStyle(8, NES.lightGray))
      .setOrigin(0.5);
    this.onEsc(() => this.scene.start("Title"));
  }

  private showWorlds(paper: Paper): void {
    this.heading("SCHOLAR'S NOTEBOOK", shorten(paper.title, 44));
    const { labels, x } = tableLabels(
      paper.worlds.map((world, i) => [
        shorten(world.name, 32),
        fraction(progressOf(worldSections(paper, i, this.notebook))),
      ]),
    );
    const items = paper.worlds.map((_, i) => ({
      label: labels[i],
      onSelect: () => this.scene.restart({ paperId: paper.id, worldIndex: i }),
    }));
    new Menu(this, x, listTop(items.length + 1), [...items, { label: "BACK", onSelect: () => this.scene.restart({}) }]);
    this.onEsc(() => this.scene.restart({}));
  }

  private showWorld(paper: Paper, worldIndex: number): void {
    const back = () => this.scene.restart({ paperId: paper.id });
    this.sections = worldSections(paper, worldIndex, this.notebook);
    this.sectionIndex = 0;
    this.pageIndex = 0;
    this.flipped = false;

    const title = paper.worlds[worldIndex].name;
    this.add.text(GAME_WIDTH / 2, 18, shorten(title, 44), textStyle(16, NES.yellow)).setOrigin(0.5);
    this.tabs = this.sections.map((section, i) =>
      this.add
        .text(40 + i * 250, 38, `${section.name} ${fraction(section)}`, textStyle(16, NES.white))
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.showSection(i)),
    );
    panel(this, PAGE_BOX.x, PAGE_BOX.y, PAGE_BOX.width, PAGE_BOX.height)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.flip());

    const arrow = (x: number, label: string, step: number) =>
      this.add
        .text(x, 412, label, textStyle(16, NES.yellow))
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.turnPage(step));
    arrow(GAME_WIDTH / 2 - 80, "<", -1);
    arrow(GAME_WIDTH / 2 + 80, ">", 1);
    this.counter = this.add.text(GAME_WIDTH / 2, 412, "", textStyle(16, NES.white)).setOrigin(0.5);
    this.flipHint = this.add.text(PAGE_BOX.x + PAGE_BOX.width, 412, "", textStyle(8, NES.yellow)).setOrigin(1, 0.5);
    this.add
      .text(GAME_WIDTH / 2, 438, "A/D: PAGE   W/S: SECTION   SPACE: FLIP CARD   ESC: BACK", textStyle(8, NES.lightGray))
      .setOrigin(0.5);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.turnPage(-1);
      else if (key === "d" || key === "arrowright") this.turnPage(1);
      else if (key === "w" || key === "arrowup") this.showSection(this.sectionIndex - 1);
      else if (key === "s" || key === "arrowdown") this.showSection(this.sectionIndex + 1);
      else if (key === " " || key === "enter") this.flip();
      else if (key === "escape") back();
      else return;
      event.preventDefault();
    });
    this.showSection(0);
  }

  private showSection(index: number): void {
    const count = this.sections.length;
    const next = (index + count) % count;
    if (next !== this.sectionIndex) audio.playSfx("move");
    this.sectionIndex = next;
    this.pageIndex = 0;
    this.tabs.forEach((tab, i) => tab.setColor(css(i === next ? NES.yellow : NES.white)));
    this.renderPage();
  }

  private turnPage(step: number): void {
    const pages = this.sections[this.sectionIndex].pages;
    const next = Phaser.Math.Clamp(this.pageIndex + step, 0, pages.length - 1);
    if (next === this.pageIndex) return;
    audio.playSfx("move");
    this.pageIndex = next;
    this.renderPage();
  }

  private flip(): void {
    const page = this.sections[this.sectionIndex].pages[this.pageIndex];
    if (!page?.question) return;
    audio.playSfx("select");
    this.flipped = !this.flipped;
    this.renderPage(true);
  }

  // Draws the current page. A new page always shows a card's front side.
  private renderPage(keepFlip = false): void {
    if (!keepFlip) this.flipped = false;
    this.pageObjects.forEach((object) => object.destroy());
    const pages = this.sections[this.sectionIndex].pages;
    this.counter.setText(pages.length > 0 ? `${this.pageIndex + 1}/${pages.length}` : "0/0");
    const page = pages[this.pageIndex];
    const left = PAGE_BOX.x + 20;
    const wrap = PAGE_BOX.width - 40;
    if (!page) {
      this.flipHint.setText("");
      this.pageObjects = [this.add.text(left, PAGE_BOX.y + 20, "Nothing in this section.", textStyle(16, NES.lightGray, wrap))];
      return;
    }

    const heading = this.add.text(left, PAGE_BOX.y + 20, page.heading, textStyle(16, page.locked ? NES.gray : NES.sky, wrap));
    const bodyTop = heading.y + heading.height + 20;
    const body = this.add.text(left, bodyTop, this.bodyText(page), textStyle(16, this.bodyColor(page), wrap));
    fitTextToHeight(body, PAGE_BOX.y + PAGE_BOX.height - 16 - bodyTop);
    this.pageObjects = [heading, body];
    this.flipHint.setText(page.question ? (this.flipped ? "SPACE: SHOW QUESTION" : "SPACE: FLIP FOR ANSWER") : "");
  }

  private bodyText(page: NotePage): string {
    const question = page.question;
    if (!question) return page.text;
    if (!this.flipped) {
      const choices = question.choices.map((choice, i) => `${CHOICE_LETTERS[i]}) ${choice}`);
      return [question.prompt, "", ...choices].join("\n");
    }
    const letter = CHOICE_LETTERS[question.answerIndex];
    return `Answer: ${letter}) ${question.choices[question.answerIndex]}\n\n${question.explanation}`;
  }

  private bodyColor(page: NotePage): number {
    if (page.locked) return NES.lightGray;
    return page.question && this.flipped ? NES.lime : NES.white;
  }
}
