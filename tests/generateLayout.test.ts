import { describe, expect, it } from "vitest";
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
});
