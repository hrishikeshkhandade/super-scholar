import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { paperProgress, worldSections } from "../src/notebook";
import { clearProgress, loadNotebook, saveProgress, unlockNote } from "../src/save";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const paper = LIBRARY[0];
const world = paper.worlds[0];

describe("Scholar's Notebook", () => {
  it("starts with everything locked", () => {
    const sections = worldSections(paper, 0, {});
    expect(sections.map((s) => s.name)).toEqual(["LESSONS", "FACTS", "CARDS"]);
    for (const section of sections) {
      expect(section.unlocked).toBe(0);
      expect(section.pages.every((page) => page.locked && page.heading.endsWith("???"))).toBe(true);
    }
    expect(paperProgress(paper, {}).unlocked).toBe(0);
  });

  it("unlocks the lesson, its practice card, and a fact from clearing level 1-1", () => {
    const storage = memoryStorage();
    unlockNote(paper.id, 0, "lesson", 0, storage);
    unlockNote(paper.id, 0, "fact", 0, storage);
    unlockNote(paper.id, 0, "fact", 0, storage); // the same fact twice counts once
    const [lessons, facts, cards] = worldSections(paper, 0, loadNotebook(storage));

    expect(lessons.unlocked).toBe(1);
    const lessonPages = lessons.pages.filter((page) => !page.locked);
    expect(lessonPages.map((page) => page.text)).toEqual(world.cutscenes[0].pages);
    expect(facts.unlocked).toBe(1);
    expect(facts.pages[0]).toMatchObject({ locked: false, text: world.facts[0] });
    expect(cards.pages[0]).toMatchObject({ locked: false, question: world.cutscenes[0].practice });
    expect(cards.unlocked).toBe(1);
  });

  it("unlocks boss questions as flashcards", () => {
    const storage = memoryStorage();
    unlockNote(paper.id, 0, "boss", 2, storage);
    const cards = worldSections(paper, 0, loadNotebook(storage))[2];
    const bossCards = cards.pages.filter((page) => page.heading.startsWith("BOSS"));
    expect(bossCards).toHaveLength(world.boss.questions.length);
    expect(bossCards[2]).toMatchObject({ locked: false, question: world.boss.questions[2] });
    expect(bossCards[0].locked).toBe(true);
  });

  it("survives a reload and is kept when progress is reset", () => {
    const storage = memoryStorage();
    saveProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 1 }, storage);
    unlockNote(paper.id, 0, "lesson", 0, storage);
    clearProgress(storage);
    expect(loadNotebook(storage)).toEqual({ [paper.id]: ["0:lesson:0"] });
  });

  it("ignores corrupted or tampered notebook data", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.notebook", "{not json");
    expect(loadNotebook(storage)).toEqual({});
    storage.setItem("super-scholar.notebook", JSON.stringify({ a: ["0:lesson:1", "<script>", 5], b: "nope" }));
    expect(loadNotebook(storage)).toEqual({ a: ["0:lesson:1"] });
  });

  it("tags boss questions the player got wrong as MISSED", () => {
    const storage = memoryStorage();
    unlockNote(paper.id, 0, "boss", 0, storage);
    unlockNote(paper.id, 0, "boss", 1, storage);
    unlockNote(paper.id, 0, "missed", 1, storage);
    const bossCards = worldSections(paper, 0, loadNotebook(storage))[2].pages.filter((page) => page.heading.startsWith("BOSS"));
    expect(bossCards[0].heading).toBe("BOSS QUESTION 1");
    expect(bossCards[1].heading).toBe("BOSS QUESTION 2 (MISSED)");
  });
});

