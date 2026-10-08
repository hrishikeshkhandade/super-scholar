import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { LEVEL_LAYOUTS } from "../src/levels/layouts";
import { parseLevel } from "../src/levels/parseLevel";
import { layoutProblems } from "../src/levels/validateLayout";

describe("parseLevel", () => {
  it("finds the start, goal, and each kind of tile", () => {
    const level = parseLevel(["  o  ", " ?H- ", "P b F", "#####"]);
    expect(level.start).toEqual({ x: 0, y: 2 });
    expect(level.goal).toEqual({ x: 4, y: 2 });
    expect(level.coins).toEqual([{ x: 2, y: 0 }]);
    expect(level.blocks.map((block) => block.contents)).toEqual(["coin", "heart"]);
    expect(level.platforms).toHaveLength(1);
    expect(level.bears).toEqual([{ x: 2, y: 2 }]);
    expect(level.ground.every((tile) => tile.top)).toBe(true);
  });

  it("rejects levels missing a start or goal, or with unknown tiles", () => {
    expect(() => parseLevel(["  F", "###"])).toThrow(/start/);
    expect(() => parseLevel(["P  ", "###"])).toThrow(/goal/);
    expect(() => parseLevel(["P X F", "#####"])).toThrow(/Unknown/);
  });
});

describe("layoutProblems", () => {
  const rows = (ground: string, above = "P" + " ".repeat(ground.length - 2) + "F") => [
    ...Array(11).fill(" ".repeat(ground.length)),
    above,
    ground,
    ground,
  ];

  it("accepts a beatable level and flags an unjumpable pit", () => {
    expect(layoutProblems(rows("####  ####"))).toEqual([]);
    expect(layoutProblems(rows("##      ##")).join()).toMatch(/too wide/);
  });

  it("flags a player or flag floating over a pit", () => {
    expect(layoutProblems(rows(" ######## ")).join()).toMatch(/start|flag/);
  });
});

describe.each(LEVEL_LAYOUTS)("hand-made level $name", (layout) => {
  it("is beatable", () => {
    expect(layoutProblems(layout.rows)).toEqual([]);
  });
});

it("has a hand-made level for every lesson in the built-in papers", () => {
  for (const paper of LIBRARY) {
    for (const world of paper.worlds) expect(world.cutscenes.length).toBeLessThanOrEqual(LEVEL_LAYOUTS.length);
  }
});
