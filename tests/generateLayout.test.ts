import { describe, expect, it } from "vitest";
import { layoutFor } from "../src/levels/chooseLayout";
import { generateLayout } from "../src/levels/generateLayout";
import { parseLevel } from "../src/levels/parseLevel";
import { layoutProblems } from "../src/levels/validateLayout";

describe("generateLayout", () => {
  it("makes 500 different levels that are all beatable, at every difficulty", () => {
    for (let seed = 1; seed <= 500; seed++) {
      const layout = generateLayout(seed, (seed % 5) / 4);
      expect(layout.rows).toHaveLength(14);
      expect(new Set(layout.rows.map((row) => row.length)).size).toBe(1);
      expect(layoutProblems(layout.rows), `seed ${seed}`).toEqual([]);
    }
  });

  it("gives the same level for the same seed", () => {
    expect(generateLayout(42, 0.5)).toEqual(generateLayout(42, 0.5));
    expect(generateLayout(42, 0.5)).not.toEqual(generateLayout(43, 0.5));
  });

  it("puts more enemies and hazards in harder levels", () => {
    const hazards = (difficulty: number) => {
      let total = 0;
      for (let seed = 1; seed <= 50; seed++) {
        const level = parseLevel(generateLayout(seed, difficulty).rows);
        total += level.bears.length + level.spikes.length;
      }
      return total;
    };
    expect(hazards(1)).toBeGreaterThan(hazards(0));
  });

  // Regression: level 1-1 of every uploaded paper had no bears (so no fun
  // facts), because the bear pieces were rated too hard for it.
  it("puts bears in every level, even the easiest, so there are fun facts to find", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const difficulty of [0, 0.1, 0.5, 1]) {
        const bears = parseLevel(generateLayout(seed, difficulty).rows).bears.length;
        expect(bears, `seed ${seed}, difficulty ${difficulty}`).toBeGreaterThanOrEqual(2);
      }
    }
    for (let level = 0; level < 3; level++) {
      expect(parseLevel(layoutFor("upload-123", 0, level).rows).bears.length).toBeGreaterThanOrEqual(2);
    }
  });
});
