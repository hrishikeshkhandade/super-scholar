import { describe, expect, it } from "vitest";
import { clearProgress, loadProgress, loadSettings, saveProgress, saveSettings } from "../src/save";

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
    storage.setItem("paper-quest.progress", "{not json");
    expect(loadProgress(storage)).toBeUndefined();
    storage.setItem("paper-quest.progress", JSON.stringify({ paperId: "p", worldIndex: -1 }));
    expect(loadProgress(storage)).toBeUndefined();
  });

  it("defaults text speed to normal and remembers changes", () => {
    const storage = memoryStorage();
    expect(loadSettings(storage).textSpeed).toBe("normal");
    saveSettings({ textSpeed: "fast" }, storage);
    expect(loadSettings(storage).textSpeed).toBe("fast");
  });

  it("still works when storage is unavailable", () => {
    expect(loadProgress(null)).toBeUndefined();
    expect(() => saveProgress({ paperId: "p", worldIndex: 0, checkpointsCleared: 0 }, null)).not.toThrow();
  });
});
