import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { paperProgress, savedNotesLine, worldSections } from "../src/notebook";
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
  // Paging past "???" pages made the Notebook hard to get around, so only
  // unlocked pages are listed, and one line says what's left to find.
  it("starts with nothing to page through, and says how to unlock each section", () => {
    const sections = worldSections(paper, 0, {});
    expect(sections.map((s) => s.name)).toEqual(["LESSONS", "FACTS", "CARDS"]);
    for (const section of sections) {
      expect(section.unlocked).toBe(0);
      expect(section.pages).toEqual([]);
    }
    expect(sections.map((s) => s.stillLocked)).toEqual([
      "3 more lessons unlock as you reach the flags in World 1.",
      "8 more facts: stomp bears in World 1 to find them.",
      `8 more cards unlock as you clear World 1's levels and face ${world.boss.name}.`,
    ]);
    expect(paperProgress(paper, {}).unlocked).toBe(0);
  });

  it("unlocks the lesson, its practice card, and a fact from clearing level 1-1", () => {
    const storage = memoryStorage();
    unlockNote(paper.id, 0, "lesson", 0, storage);
    unlockNote(paper.id, 0, "fact", 0, storage);
    unlockNote(paper.id, 0, "fact", 0, storage); // the same fact twice counts once
    const [lessons, facts, cards] = worldSections(paper, 0, loadNotebook(storage));

    expect(lessons.unlocked).toBe(1);
    expect(lessons.pages.map((page) => page.text)).toEqual(world.cutscenes[0].pages);
    expect(lessons.stillLocked).toBe("2 more lessons unlock as you reach the flags in World 1.");
    expect(facts.unlocked).toBe(1);
    expect(facts.pages).toEqual([{ heading: "FUN FACT 1", text: world.facts[0] }]);
    expect(cards.pages[0]).toMatchObject({ question: world.cutscenes[0].practice });
    expect(cards.unlocked).toBe(1);
  });

  it("unlocks boss questions as flashcards", () => {
    const storage = memoryStorage();
    unlockNote(paper.id, 0, "boss", 2, storage);
    const cards = worldSections(paper, 0, loadNotebook(storage))[2];
    expect(cards.pages).toEqual([{ heading: "BOSS QUESTION 3", text: "", question: world.boss.questions[2] }]);
    expect(cards.stillLocked).toBe(`7 more cards unlock as you clear World 1's levels and face ${world.boss.name}.`);
  });

  it("says nothing is left once a section is complete", () => {
    const storage = memoryStorage();
    world.facts.forEach((_, i) => unlockNote(paper.id, 0, "fact", i, storage));
    expect(worldSections(paper, 0, loadNotebook(storage))[1].stillLocked).toBeUndefined();
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

  it("says on LEVEL CLEAR exactly what the level saved to the Notebook", () => {
    expect(savedNotesLine(2, true)).toBe("LESSON, FLASHCARD & 2 FACTS SAVED TO YOUR NOTEBOOK");
    expect(savedNotesLine(1, true)).toBe("LESSON, FLASHCARD & 1 FACT SAVED TO YOUR NOTEBOOK");
    expect(savedNotesLine(0, true)).toBe("LESSON & FLASHCARD SAVED TO YOUR NOTEBOOK");
    expect(savedNotesLine(3, false)).toBe("LESSON & 3 FACTS SAVED TO YOUR NOTEBOOK");
    expect(savedNotesLine(0, false)).toBe("LESSON SAVED TO YOUR NOTEBOOK");
  });
});
