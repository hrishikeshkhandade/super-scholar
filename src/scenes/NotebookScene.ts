import Phaser from "phaser";
import { audio } from "../audio/audio";
import { findPaper, playablePapers } from "../content/library";
import type { Paper } from "../content/types";
import { paperProgress, progressOf, worldSections, type NotePage, type NoteSection } from "../notebook";
import { NES, css } from "../palette";
import { loadNotebook, type Notebook } from "../save";
import { isTouchDevice } from "../touchControls";
import { fitTextToHeight, GAME_WIDTH, Menu, panel, READING, textStyle } from "../ui";
import { listTop, paperLabel, shorten, tableLabels } from "./listLayout";
import { drawMenuBackdrop } from "./backdrop";

// The Scholar's Notebook: review every lesson, fun fact, and question
// unlocked so far. Two views in one scene: the papers, then one paper's
// pages, a world at a time (the world list was a screen too many).

export interface NotebookData {
  paperId?: string;
  worldIndex?: number;
  sectionIndex?: number; // kept when switching worlds
  // Where BACK goes when another screen opened the Notebook (like REVIEW
  // RESULTS' RE-READ); otherwise it's the Notebook's paper list.
  back?: { scene: string; data: object };
}

// The top rows say where you are: the paper, the world (with arrows to
// switch), and the section tabs, all inside the backdrop's frame.
const PAPER_Y = 32;
const WORLD_Y = 56;
const TABS = { y: 74, height: 28, gap: 12 };
const PAGE_BOX = { x: 24, y: 112, width: GAME_WIDTH - 48, height: 276 };
const BOTTOM_ROW_Y = 405;
// What each section holds, on the first screen, so new players know what the
// Notebook is for (a classmate found it unclear).
const SECTION_KEY: [string, string][] = [
  ["LESSONS", "The professor's lessons, from each level's flag"],
  ["FACTS", "Fun facts from the bears you stomp"],
  ["CARDS", "Flashcards of practice and boss questions"],
];
const KEY = { top: 106, lineHeight: 16, tabWidth: 10 }; // tabWidth in letters
const LIST_TOP = KEY.top + SECTION_KEY.length * KEY.lineHeight + 20;

const fraction = ({ unlocked, total }: { unlocked: number; total: number }) => `${unlocked}/${total}`;

interface Tab {
  box: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
}

export class NotebookScene extends Phaser.Scene {
  private notebook: Notebook = {};
  private sections: NoteSection[] = [];
  private sectionIndex = 0;
  private pageIndex = 0;
  private flipped = false;
  private tabs: Tab[] = [];
  private pageObjects: Phaser.GameObjects.GameObject[] = [];
  private counter!: Phaser.GameObjects.Text;
  private flipHint!: Phaser.GameObjects.Text;

  constructor() {
    super("Notebook");
  }

  create(data: NotebookData): void {
    drawMenuBackdrop(this);
    this.notebook = loadNotebook();
    const paper = data.paperId ? findPaper(data.paperId) : undefined;
    if (paper) this.showWorld(paper, data.worldIndex ?? firstWorldWithNotes(paper, this.notebook), data.sectionIndex ?? 0, data.back);
    else this.showPapers();
  }

  private heading(text: string, subtitle: string): void {
    this.add.text(GAME_WIDTH / 2, 40, text, textStyle(24, NES.yellow)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, 80, subtitle, textStyle(16, NES.sky)).setOrigin(0.5);
  }

  private onEsc(action: () => void): void {
    this.input.keyboard?.on("keydown-ESC", action);
  }

  private showPapers(): void {
    this.heading("SCHOLAR'S NOTEBOOK", "Review everything you've unlocked");
    const keyWidth = (KEY.tabWidth + Math.max(...SECTION_KEY.map(([, about]) => about.length))) * 8;
    const keyX = Math.round((GAME_WIDTH - keyWidth) / 2);
    SECTION_KEY.forEach(([tab, about], i) => {
      const y = KEY.top + i * KEY.lineHeight;
      this.add.text(keyX, y, tab, textStyle(8, NES.yellow));
      this.add.text(keyX + KEY.tabWidth * 8, y, about, textStyle(8, NES.white));
    });

    const papers = playablePapers();
    const { labels, x } = tableLabels(papers.map((paper) => [paperLabel(paper), fraction(paperProgress(paper, this.notebook))]));
    const items = papers.map((paper, i) => ({
      label: labels[i],
      onSelect: () => this.scene.restart({ paperId: paper.id }),
    }));
    // With every upload slot full the list only fits with tighter rows.
    const spacing = items.length > 6 ? 12 : 20;
    new Menu(this, x, listTop(items.length + 1, LIST_TOP), [...items, { label: "BACK", onSelect: () => this.scene.start("Title") }], { spacing });
    this.onEsc(() => this.scene.start("Title"));
  }

  private showWorld(paper: Paper, worldIndex: number, sectionIndex: number, backTo?: NotebookData["back"]): void {
    const back = () => (backTo ? this.scene.start(backTo.scene, backTo.data) : this.scene.restart({}));
    const switchWorld = (step: number) => {
      const next = worldIndex + step;
      if (!paper.worlds[next]) return;
      audio.playSfx("move");
      this.scene.restart({ paperId: paper.id, worldIndex: next, sectionIndex: this.sectionIndex, back: backTo });
    };
    this.sections = worldSections(paper, worldIndex, this.notebook);
    this.pageIndex = 0;
    this.flipped = false;

    // Where you are: the paper, then the world, with arrows to the others.
    this.add.text(GAME_WIDTH / 2, PAPER_Y, shorten(paper.title, 46), textStyle(16, NES.sky)).setOrigin(0.5);
    this.add.text(GAME_WIDTH / 2, WORLD_Y, shorten(paper.worlds[worldIndex].name, 36), textStyle(16, NES.yellow)).setOrigin(0.5);
    const worldArrow = (x: number, label: string, step: number) => {
      const exists = paper.worlds[worldIndex + step] !== undefined;
      const arrow = this.add.text(x, WORLD_Y, label, textStyle(16, exists ? NES.yellow : NES.gray)).setOrigin(0.5).setPadding(10, 6, 10, 6);
      if (exists) arrow.setInteractive({ useHandCursor: true }).on("pointerdown", () => switchWorld(step));
    };
    worldArrow(PAGE_BOX.x + 12, "<", -1);
    worldArrow(PAGE_BOX.x + PAGE_BOX.width - 12, ">", 1);

    // The sections as tabs: boxes you can click, the open one filled in.
    const tabWidth = (PAGE_BOX.width - TABS.gap * 2) / 3;
    this.tabs = this.sections.map((section, i) => {
      const x = PAGE_BOX.x + i * (tabWidth + TABS.gap);
      const box = this.add.rectangle(x, TABS.y, tabWidth, TABS.height, NES.black).setOrigin(0, 0).setStrokeStyle(2, NES.white);
      const label = this.add.text(x + tabWidth / 2, TABS.y + TABS.height / 2, `${i + 1} ${section.name} ${fraction(section)}`, textStyle(16, NES.white)).setOrigin(0.5);
      box.setInteractive({ useHandCursor: true });
      // The label answers taps over the whole tab, the same as its box.
      label.setInteractive({
        useHandCursor: true,
        hitArea: new Phaser.Geom.Rectangle((label.width - tabWidth) / 2, (label.height - TABS.height) / 2, tabWidth, TABS.height),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
      });
      for (const part of [box, label]) part.on("pointerdown", () => this.showSection(i));
      return { box, label };
    });

    panel(this, PAGE_BOX.x, PAGE_BOX.y, PAGE_BOX.width, PAGE_BOX.height)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", () => this.flip());

    const pageArrow = (x: number, label: string, step: number) =>
      this.add
        .text(x, BOTTOM_ROW_Y, label, textStyle(16, NES.yellow))
        .setOrigin(0.5)
        .setPadding(10, 6, 10, 6)
        .setInteractive({ useHandCursor: true })
        .on("pointerdown", () => this.turnPage(step));
    pageArrow(GAME_WIDTH / 2 - 130, "<", -1);
    pageArrow(GAME_WIDTH / 2 + 130, ">", 1);
    this.counter = this.add.text(GAME_WIDTH / 2, BOTTOM_ROW_Y, "", textStyle(16, NES.white)).setOrigin(0.5);
    this.flipHint = this.add.text(PAGE_BOX.x + PAGE_BOX.width, BOTTOM_ROW_Y, "", textStyle(8, NES.yellow)).setOrigin(1, 0.5);
    this.add
      .text(
        GAME_WIDTH / 2,
        428,
        isTouchDevice()
          ? "TAP < > FOR PAGES AND WORLDS, A TAB FOR A SECTION, A CARD TO FLIP IT"
          : "A/D: PAGE   W/S OR 1-3: SECTION   Q/E: WORLD   SPACE: FLIP CARD   ESC: BACK",
        textStyle(8, NES.lightGray),
      )
      .setOrigin(0.5);
    // A visible way out, since phones have no Esc key.
    this.add
      .text(PAGE_BOX.x + 8, BOTTOM_ROW_Y, "BACK", textStyle(16, NES.white))
      .setOrigin(0, 0.5)
      .setPadding(8, 8, 8, 8)
      .setInteractive({ useHandCursor: true })
      .on("pointerdown", back);

    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => {
      if (event.repeat) return;
      const key = event.key.toLowerCase();
      if (key === "a" || key === "arrowleft") this.turnPage(-1);
      else if (key === "d" || key === "arrowright") this.turnPage(1);
      else if (key === "w" || key === "arrowup") this.showSection(this.sectionIndex - 1);
      else if (key === "s" || key === "arrowdown") this.showSection(this.sectionIndex + 1);
      else if (key === "1" || key === "2" || key === "3") this.showSection(Number(key) - 1);
      else if (key === "q") switchWorld(-1);
      else if (key === "e") switchWorld(1);
      else if (key === " " || key === "enter") this.flip();
      else if (key === "escape") back();
      else return;
      event.preventDefault();
    });
    this.sectionIndex = -1; // so the first showSection doesn't play the move sound
    this.showSection(sectionIndex);
  }

  private showSection(index: number): void {
    const count = this.sections.length;
    const next = (index + count) % count;
    if (this.sectionIndex >= 0 && next !== this.sectionIndex) audio.playSfx("move");
    this.sectionIndex = next;
    this.pageIndex = 0;
    this.tabs.forEach(({ box, label }, i) => {
      box.setFillStyle(i === next ? NES.yellow : NES.black);
      label.setColor(css(i === next ? NES.black : NES.white));
    });
    this.renderPage();
  }

  private turnPage(step: number): void {
    const pages = this.sections[this.sectionIndex].pages;
    const next = Phaser.Math.Clamp(this.pageIndex + step, 0, pages.length - 1);
    if (next === this.pageIndex || pages.length === 0) return;
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

  // Draws the current page, with the line saying what's still to find at the
  // bottom of the box. A new page always shows a card's front side.
  private renderPage(keepFlip = false): void {
    if (!keepFlip) this.flipped = false;
    this.pageObjects.forEach((object) => object.destroy());
    const section = this.sections[this.sectionIndex];
    const pages = section.pages;
    this.counter.setText(pages.length > 0 ? `PAGE ${this.pageIndex + 1} OF ${pages.length}` : "NO PAGES YET");
    const left = PAGE_BOX.x + 20;
    const wrap = READING.width; // short reading lines, like the rest of the game
    const stillLocked = section.stillLocked
      ? this.add
          .text(left, PAGE_BOX.y + PAGE_BOX.height - 14, section.stillLocked, textStyle(16, NES.lightGray, PAGE_BOX.width - 40))
          .setOrigin(0, 1)
      : undefined;
    const bottom = (stillLocked ? stillLocked.y - stillLocked.height : PAGE_BOX.y + PAGE_BOX.height) - 16;
    const page = pages[this.pageIndex];
    if (!page) {
      this.flipHint.setText("");
      const empty = this.add.text(left, PAGE_BOX.y + 20, "Nothing here yet.", textStyle(16, NES.white, wrap));
      this.pageObjects = [empty, ...(stillLocked ? [stillLocked] : [])];
      return;
    }

    const heading = this.add.text(left, PAGE_BOX.y + 20, page.heading, textStyle(16, NES.sky, wrap));
    const bodyTop = heading.y + heading.height + 20;
    const body = this.add.text(left, bodyTop, this.bodyText(page), textStyle(16, page.question && this.flipped ? NES.lime : NES.white, wrap));
    fitTextToHeight(body, bottom - bodyTop);
    this.pageObjects = [heading, body, ...(stillLocked ? [stillLocked] : [])];
    this.flipHint.setText(page.question ? (this.flipped ? "SPACE: SHOW QUESTION" : "SPACE: FLIP FOR ANSWER") : "");
  }

  private bodyText(page: NotePage): string {
    const question = page.question;
    if (!question) return page.text;
    // A flashcard: the question alone, so the answer is recalled, not
    // picked from a list (and it fits the short reading lines).
    if (!this.flipped) return question.prompt;
    return `Answer: ${question.choices[question.answerIndex]}\n\n${question.explanation}`;
  }
}

// Opening a paper starts on its first world with anything in it (or World 1).
function firstWorldWithNotes(paper: Paper, notebook: Notebook): number {
  const index = paper.worlds.findIndex((_, i) => progressOf(worldSections(paper, i, notebook)).unlocked > 0);
  return Math.max(index, 0);
}
