import { describe, expect, it } from "vitest";
import { layoutFor } from "../src/levels/chooseLayout";
import { CHALLENGE_KINDS, chunkLevels, generateLayout } from "../src/levels/generateLayout";
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

  it("makes every chunk beatable on its own", () => {
    chunkLevels().forEach((rows, index) => expect(layoutProblems(rows), `chunk ${index}`).toEqual([]));
  });

  it("always includes the kinds of challenge a level asks for", () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const difficulty of [0.35, 0.6, 1]) {
        const required = [CHALLENGE_KINDS[seed % 4], CHALLENGE_KINDS[(seed + 1) % 4]];
        const layout = generateLayout(seed, difficulty, required);
        for (const kind of required) expect(layout.challenges, `seed ${seed}`).toContain(kind);
        expect(layoutProblems(layout.rows), `seed ${seed}`).toEqual([]);
      }
    }
  });

  // A classmate found the levels "spoon-fed": single hops only.
  it("gives World 1 of every paper all four kinds of challenge across its first two levels", () => {
    for (const paper of ["upload-a", "upload-b", "upload-c"]) {
      const kinds = new Set([0, 1].flatMap((level) => (layoutFor(paper, 0, level) as ReturnType<typeof generateLayout>).challenges));
      expect([...kinds].sort()).toEqual([...CHALLENGE_KINDS].sort());
    }
  });

  it("makes HARD mode's layouts harder than NORMAL's", () => {
    const hazards = (extra: number) => {
      let total = 0;
      for (const paper of ["a", "b", "c", "d", "e"]) {
        for (let level = 0; level < 3; level++) {
          const parsed = parseLevel(layoutFor(paper, 0, level, extra).rows);
          total += parsed.bears.length + parsed.spikes.length + parsed.movingPlatforms.length;
        }
      }
      return total;
    };
    expect(hazards(0.3)).toBeGreaterThan(hazards(0));
  });
});
