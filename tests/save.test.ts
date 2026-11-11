import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import {
  clearProgress,
  hasSeenTutorial,
  hasSentFeedback,
  loadProgress,
  loadSettings,
  loadUploadedPapers,
  markFeedbackSent,
  markTutorialSeen,
  saveProgress,
  saveSettings,
  saveUploadedPaper,
  startLives,
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
    expect(loadSettings(storage)).toEqual({ textSpeed: "normal", musicVolume: 100, musicStyle: "tradingFloor", sfxVolume: 100, difficulty: "normal" });
    const changed = { textSpeed: "fast", musicVolume: 25, musicStyle: "upbeat", sfxVolume: 0, difficulty: "hard" } as const;
    saveSettings(changed, storage);
    expect(loadSettings(storage)).toEqual(changed);
  });

  it("keeps old saves working and ignores bad setting values", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.settings", JSON.stringify({ textSpeed: "slow" }));
    expect(loadSettings(storage)).toEqual({ textSpeed: "slow", musicVolume: 100, musicStyle: "tradingFloor", sfxVolume: 100, difficulty: "normal" });
    storage.setItem("super-scholar.settings", JSON.stringify({ musicVolume: 33, sfxVolume: "loud", musicStyle: "jazz" }));
    expect(loadSettings(storage)).toMatchObject({ musicVolume: 100, sfxVolume: 100, musicStyle: "tradingFloor" });
  });

  it("starts worlds with fewer hearts on HARD, and falls back to NORMAL for bad values", () => {
    const storage = memoryStorage();
    expect(startLives(storage)).toBe(3);
    saveSettings({ ...loadSettings(storage), difficulty: "hard" }, storage);
    expect(startLives(storage)).toBe(2);
    storage.setItem("super-scholar.settings", JSON.stringify({ difficulty: "nightmare" }));
    expect(loadSettings(storage).difficulty).toBe("normal");
    expect(startLives(storage)).toBe(3);
  });

  // Saves from before volume levels had on/off switches; they carry over
  // (on = full volume, as before; off stays off).
  it("turns old on/off sound settings into volumes", () => {
    const storage = memoryStorage();
    storage.setItem("super-scholar.settings", JSON.stringify({ music: false, sfx: true }));
    expect(loadSettings(storage)).toMatchObject({ musicVolume: 0, sfxVolume: 100 });
  });

  it("remembers that feedback was sent, even after progress is erased", () => {
    const storage = memoryStorage();
    expect(hasSentFeedback(storage)).toBe(false);
    markFeedbackSent(storage);
    expect(hasSentFeedback(storage)).toBe(true);
    clearProgress(storage);
    expect(hasSentFeedback(storage)).toBe(true);
    expect(hasSentFeedback(null)).toBe(false);
  });

  it("remembers that the tour was seen, even after progress is erased", () => {
    const storage = memoryStorage();
    expect(hasSeenTutorial(storage)).toBe(false);
    markTutorialSeen(storage);
    expect(hasSeenTutorial(storage)).toBe(true);
    clearProgress(storage);
    expect(hasSeenTutorial(storage)).toBe(true);
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
