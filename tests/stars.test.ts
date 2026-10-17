import { describe, expect, it } from "vitest";
import { BossFight } from "../src/bossFight";
import { clearProgress, loadStars, saveBestStars } from "../src/save";
import { bossStars, levelStars } from "../src/stars";

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    removeItem: (key: string) => void data.delete(key),
  };
}

describe("star ratings", () => {
  it("gives a level 1 star for clearing, plus coins and no hits", () => {
    expect(levelStars({ coinsCollected: 0, coinsInLevel: 12, hits: 2 })).toBe(1);
    expect(levelStars({ coinsCollected: 9, coinsInLevel: 12, hits: 2 })).toBe(2); // 9 of 12 is 75%
    expect(levelStars({ coinsCollected: 8, coinsInLevel: 12, hits: 0 })).toBe(2);
    expect(levelStars({ coinsCollected: 12, coinsInLevel: 12, hits: 0 })).toBe(3);
    expect(levelStars({ coinsCollected: 0, coinsInLevel: 0, hits: 0 })).toBe(3); // no coins to find
  });

  it("gives a boss stars for no wrong answers and no hits", () => {
    expect(bossStars({ wrongAnswers: 0, hits: 0 })).toBe(3);
    expect(bossStars({ wrongAnswers: 1, hits: 0 })).toBe(2);
    expect(bossStars({ wrongAnswers: 2, hits: 3 })).toBe(1);
  });

  it("counts wrong answers in a boss fight", () => {
    const question = { prompt: "Q?", choices: ["a", "b"], answerIndex: 0, explanation: "" };
    const fight = new BossFight([question]);
    fight.answer(1);
    fight.answer(0);
    expect(fight.wrongAnswers).toBe(1);
    expect(fight.defeated).toBe(true);
  });
});

describe("saving stars", () => {
  it("keeps the best rating, so replays can only raise it", () => {
    const storage = memoryStorage();
    saveBestStars("p", 0, 0, 2, storage);
    saveBestStars("p", 0, 0, 1, storage);
    expect(loadStars(storage)).toEqual({ p: { "0:0": 2 } });
    saveBestStars("p", 0, 0, 3, storage);
    saveBestStars("p", 0, "boss", 1, storage);
    expect(loadStars(storage)).toEqual({ p: { "0:0": 3, "0:boss": 1 } });
  });

  it("ignores impossible or tampered ratings", () => {
    const storage = memoryStorage();
    saveBestStars("p", 0, 0, 7, storage);
    expect(loadStars(storage)).toEqual({});
    storage.setItem("super-scholar.stars", JSON.stringify({ p: { "0:0": 3, "0:1": 99, hack: 2 }, q: [1] }));
    expect(loadStars(storage)).toEqual({ p: { "0:0": 3 } });
  });

  it("forgets stars when progress is reset", () => {
    const storage = memoryStorage();
    saveBestStars("p", 0, 0, 3, storage);
    clearProgress(storage);
    expect(loadStars(storage)).toEqual({});
  });
});
