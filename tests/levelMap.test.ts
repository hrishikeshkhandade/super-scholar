import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { levelMap, mapProgress, stagesReached } from "../src/levelMap";
import { advanceProgress, clearProgress, loadCleared, loadProgress, markCleared, saveProgress } from "../src/save";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

const paper = LIBRARY[0]; // 5 worlds, 3 levels + a boss each
const states = (map: ReturnType<typeof levelMap>, world: number) => map[world].stops.map((stop) => stop.state);

describe("level map", () => {
  it("opens only 1-1 for a new player", () => {
    const map = levelMap(paper, {});
    expect(map).toHaveLength(5);
    expect(map[0].stops.map((stop) => stop.label)).toEqual(["1-1", "1-2", "1-3", "BOSS"]);
    expect(states(map, 0)).toEqual(["open", "locked", "locked", "locked"]);
    expect(states(map, 4)).toEqual(["locked", "locked", "locked", "locked"]);
    expect(mapProgress(map)).toEqual({ cleared: 0, total: 20 });
  });

  it("lights cleared levels and opens the next one", () => {
    const map = levelMap(paper, { [paper.id]: ["0:0", "0:1"] });
    expect(states(map, 0)).toEqual(["cleared", "cleared", "open", "locked"]);
  });

  it("counts progress saved before the level select existed", () => {
    const map = levelMap(paper, {}, { paperId: paper.id, worldIndex: 1, checkpointsCleared: 1 });
    expect(states(map, 0)).toEqual(["cleared", "cleared", "cleared", "cleared"]);
    expect(states(map, 1)).toEqual(["cleared", "open", "locked", "locked"]);
    // Progress in a different paper doesn't count here.
    expect(states(levelMap(paper, {}, { paperId: "other", worldIndex: 3, checkpointsCleared: 0 }), 0)[0]).toBe("open");
  });

  it("lights everything once the paper is finished", () => {
    const map = levelMap(paper, {}, { paperId: paper.id, worldIndex: 5, checkpointsCleared: 0 });
    expect(mapProgress(map)).toEqual({ cleared: 20, total: 20 });
  });
});

describe("saving cleared levels and progress", () => {
  it("remembers cleared levels and bosses across a reload", () => {
    const storage = memoryStorage();
    markCleared(paper.id, 0, 0, storage);
    markCleared(paper.id, 0, "boss", storage);
    markCleared(paper.id, 0, 0, storage); // twice counts once
    expect(loadCleared(storage)).toEqual({ [paper.id]: ["0:0", "0:boss"] });
  });

  it("forgets cleared levels when progress is reset", () => {
    const storage = memoryStorage();
    markCleared(paper.id, 0, 0, storage);
    clearProgress(storage);
    expect(loadCleared(storage)).toEqual({});
  });

  it("ignores tampered cleared-level data", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.cleared", JSON.stringify({ a: ["0:1", "0:everything", 7], b: "x" }));
    expect(loadCleared(storage)).toEqual({ a: ["0:1"] });
  });

  // Regression guard: replaying an earlier level must not rewind CONTINUE.
  it("only moves CONTINUE forward within the same paper", () => {
    const storage = memoryStorage();
    saveProgress({ paperId: paper.id, worldIndex: 3, checkpointsCleared: 1 }, storage);
    advanceProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 1 }, storage);
    expect(loadProgress(storage)).toEqual({ paperId: paper.id, worldIndex: 3, checkpointsCleared: 1 });
    advanceProgress({ paperId: paper.id, worldIndex: 3, checkpointsCleared: 2 }, storage);
    expect(loadProgress(storage)?.checkpointsCleared).toBe(2);
    advanceProgress({ paperId: "another-paper", worldIndex: 0, checkpointsCleared: 1 }, storage);
    expect(loadProgress(storage)?.paperId).toBe("another-paper");
  });

  // Regression (student report): NEW GAME reset CONTINUE to 1-1, and levels
  // that only counted as cleared through CONTINUE went dark on the map.
  it("keeps levels lit when the player starts the paper over", () => {
    const storage = memoryStorage();
    const before = { paperId: paper.id, worldIndex: 1, checkpointsCleared: 1 };
    for (const { worldIndex, stage } of stagesReached(paper, before)) markCleared(paper.id, worldIndex, stage, storage);
    saveProgress({ paperId: paper.id, worldIndex: 0, checkpointsCleared: 0 }, storage); // NEW GAME
    const map = levelMap(paper, loadCleared(storage), loadProgress(storage));
    expect(states(map, 0)).toEqual(["cleared", "cleared", "cleared", "cleared"]);
    expect(states(map, 1)).toEqual(["cleared", "open", "locked", "locked"]);
  });
});
