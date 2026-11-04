import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { needsRereading, reviewStage } from "../src/review";

describe("review mode", () => {
  it("marks a section to re-read below 4 of 5 right on the first try", () => {
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 5, total: 5 })).toBe(false);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 4, total: 5 })).toBe(false);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 3, total: 5 })).toBe(true);
    expect(needsRereading({ worldIndex: 0, rightFirstTry: 2, total: 3 })).toBe(true);
  });

  it("goes straight to a world's boss and never counts toward progress", () => {
    const paper = LIBRARY[0];
    const stage = reviewStage(paper, 2, [{ worldIndex: 0, rightFirstTry: 5, total: 5 }]);
    expect(stage.worldIndex).toBe(2);
    expect(stage.checkpointsCleared).toBe(paper.worlds[2].cutscenes.length);
    expect(stage.replay).toBe(true);
    expect(stage.review).toHaveLength(1);
  });
});
