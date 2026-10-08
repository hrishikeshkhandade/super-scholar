import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import {
  clearProgress,
  loadProgress,
  loadSettings,
  loadUploadedPapers,
  saveProgress,
  saveSettings,
  saveUploadedPaper,
} from "../src/save";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("save data", () => {
  it("remembers progress so Continue works", () => {
    const storage = memoryStorage();
    expect(loadProgress(storage)).toBeUndefined();
    saveProgress({ paperId: "p", worldIndex: 0, checkpointsCleared: 2 }, storage);
    expect(loadProgress(storage)).toEqual({ paperId: "p", worldIndex: 0, checkpointsCleared: 2 });
    clearProgress(storage);
    expect(loadProgress(storage)).toBeUndefined();
  });

  it("ignores corrupted progress instead of crashing", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.progress", "{not json");
    expect(loadProgress(storage)).toBeUndefined();
    storage.setItem("super-scholar.progress", JSON.stringify({ paperId: "p", worldIndex: -1 }));
    expect(loadProgress(storage)).toBeUndefined();
  });

  it("starts with default settings and remembers changes", () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual({ textSpeed: "normal", music: true, musicStyle: "upbeat", sfx: true });
    const changed = { textSpeed: "fast", music: false, musicStyle: "tradingFloor", sfx: false } as const;
    saveSettings(changed, storage);
    expect(loadSettings(storage)).toEqual(changed);
  });

  it("keeps old saves working and ignores bad setting values", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.settings", JSON.stringify({ textSpeed: "slow" }));
    expect(loadSettings(storage)).toEqual({ textSpeed: "slow", music: true, musicStyle: "upbeat", sfx: true });
    storage.setItem("super-scholar.settings", JSON.stringify({ music: "loud", musicStyle: "jazz" }));
    expect(loadSettings(storage).music).toBe(true);
    expect(loadSettings(storage).musicStyle).toBe("upbeat");
  });

  it("still works when storage is unavailable", () => {
    expect(loadProgress(null)).toBeUndefined();
    expect(() => saveProgress({ paperId: "p", worldIndex: 0, checkpointsCleared: 0 }, null)).not.toThrow();
  });

  it("keeps the 3 newest uploaded papers and skips corrupted ones", () => {
    const storage = memoryStorage();
    const paper = LIBRARY[0];
    for (const id of ["a", "b", "c", "d"]) saveUploadedPaper({ ...paper, id }, storage);
    saveUploadedPaper({ ...paper, id: "b" }, storage);
    expect(loadUploadedPapers(storage).map((saved) => saved.id)).toEqual(["b", "d", "c"]);
    storage.setItem("super-scholar.uploads", JSON.stringify([{ id: "broken" }, { ...paper, id: "ok" }]));
    expect(loadUploadedPapers(storage).map((saved) => saved.id)).toEqual(["ok"]);
  });
});
