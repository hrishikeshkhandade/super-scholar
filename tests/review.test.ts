import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { worldSections } from "../src/notebook";
import { loadNotebook } from "../src/save";
import { needsRereading, reviewAgain, reviewStage, startReview, unlockForRereading } from "../src/review";

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
});
