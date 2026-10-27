import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { levelFacts, nextFact } from "../src/foundFacts";

describe("facts in a level", () => {
  it("splits a world's facts across its levels with no fact in two levels", () => {
    expect([0, 1, 2].map((level) => levelFacts(8, 3, level))).toEqual([
      [0, 1],
      [2, 3, 4],
      [5, 6, 7],
    ]);
  });

  it("gives every built-in world's facts out exactly once across its levels", () => {
    for (const paper of LIBRARY) {
      for (const world of paper.worlds) {
        const levels = world.cutscenes.length;
        const given = Array.from({ length: levels }, (_, level) => levelFacts(world.facts.length, levels, level)).flat();
        expect(given).toEqual(world.facts.map((_, index) => index));
      }
    }
  });

  it("gives this level's facts in order, then nothing once they're all found", () => {
    let found: number[] = [];
    const given: (number | undefined)[] = [];
    for (let bear = 0; bear < 4; bear++) {
      const index = nextFact(found, 8, 3, 1);
      given.push(index);
      if (index !== undefined) found = [...found, index];
    }
    expect(given).toEqual([2, 3, 4, undefined]);
  });

  it("skips facts already found before a pit fall restarted the level", () => {
    expect(nextFact([2], 8, 3, 1)).toBe(3);
  });
});
