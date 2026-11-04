import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { worldSections } from "../src/notebook";
import { forgetNote, loadNotebook, unlockNote } from "../src/save";
import { MISSED_PER_FIGHT, missedQuestions, missedScores, needsRereading, reviewAgain, reviewStage, startMissedReview, startReview, unlockForRereading } from "../src/review";

describe("review mode", () => {
  it("marks a section to re-read below 4 of 5 right on the first try", () => {
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 5, total: 5 })).toBe(false);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 4, total: 5 })).toBe(false);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 3, total: 5 })).toBe(true);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 2, total: 3 })).toBe(true);
  });

  it("goes straight to a world's boss and never counts toward progress", () => {
    const paper = LIBRARY[0];
    const stage = reviewStage(paper, 2, { scores: [{ worldIndex: 0, rightFirstTry: 5, total: 5 }], lastWorld: 4 });
    expect(stage.worldIndex).toBe(2);
    expect(stage.checkpointsCleared).toBe(paper.worlds[2].cutscenes.length);
    expect(stage.replay).toBe(true);
    expect(stage.review?.scores).toHaveLength(1);
  });

  // Reviewing meant beating every boss before seeing a score; one section
  // can now be checked on its own.
  it("reviews all sections, or just one, and REVIEW AGAIN repeats the same ones", () => {
    const paper = LIBRARY[0];
    expect(startReview(paper)).toMatchObject({ worldIndex: 0, review: { scores: [], lastWorld: paper.worlds.length - 1 } });
    expect(startReview(paper, 2)).toMatchObject({ worldIndex: 2, review: { scores: [], lastWorld: 2 } });
    const one = [{ worldIndex: 2, rightFirstTry: 3, total: 5 }];
    expect(reviewAgain(paper, one)).toMatchObject({ worldIndex: 2, review: { scores: [], lastWorld: 2 } });
    const all = paper.worlds.map((_, i) => ({ worldIndex: i, rightFirstTry: 5, total: 5 }));
    expect(reviewAgain(paper, all)).toMatchObject({ worldIndex: 0, review: { lastWorld: paper.worlds.length - 1 } });
  });

  it("unlocks a section's lessons for re-reading, so the Notebook has them to show", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => void data.set(key, value),
      removeItem: (key: string) => void data.delete(key),
    } as Storage;
    const paper = LIBRARY[0];
    unlockForRereading(paper, 1, storage);
    const [lessons] = worldSections(paper, 1, loadNotebook(storage));
    expect(lessons.unlocked).toBe(paper.worlds[1].cutscenes.length);
    expect(lessons.stillLocked).toBeUndefined();
    expect(worldSections(paper, 0, loadNotebook(storage))[0].unlocked).toBe(0); // only that world
  });

  // Retesting only what you got wrong is how studying works best.
  describe("missed questions", () => {
    const memory = () => {
      const data = new Map<string, string>();
      return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => void data.set(key, value),
        removeItem: (key: string) => void data.delete(key),
      } as Storage;
    };
    const paper = LIBRARY[0];

    it("lists the boss questions missed on a paper, oldest first", () => {
      const storage = memory();
      unlockNote(paper.id, 2, "missed", 4, storage);
      unlockNote(paper.id, 0, "boss", 1, storage);
      unlockNote(paper.id, 0, "missed", 1, storage);
      expect(missedQuestions(paper, loadNotebook(storage))).toEqual([
        { worldIndex: 2, questionIndex: 4 },
        { worldIndex: 0, questionIndex: 1 },
      ]);
    });

    it("drops a question from the list once its tag is removed", () => {
      const storage = memory();
      unlockNote(paper.id, 0, "missed", 1, storage);
      unlockNote(paper.id, 1, "missed", 2, storage);
      forgetNote(paper.id, 0, "missed", 1, storage);
      expect(missedQuestions(paper, loadNotebook(storage))).toEqual([{ worldIndex: 1, questionIndex: 2 }]);
    });

    it("asks at most 8 in one fight", () => {
      const many = Array.from({ length: 12 }, (_, i) => ({ worldIndex: i % 5, questionIndex: Math.floor(i / 5) }));
      expect(startMissedReview(paper, many).review?.missed).toHaveLength(MISSED_PER_FIGHT);
    });

    it("scores a missed-questions fight by section", () => {
      const missed = [
        { worldIndex: 0, questionIndex: 1 },
        { worldIndex: 2, questionIndex: 0 },
        { worldIndex: 0, questionIndex: 3 },
      ];
      const wrongAgain = (question: { worldIndex: number; questionIndex: number }) => question.questionIndex === 3;
      expect(missedScores(missed, wrongAgain)).toEqual([
        { worldIndex: 0, rightFirstTry: 1, total: 2 },
        { worldIndex: 2, rightFirstTry: 1, total: 1 },
      ]);
    });
  });
});
