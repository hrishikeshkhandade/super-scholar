import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { LEVEL_LAYOUTS } from "../src/levels/layouts";
import { parseLevel } from "../src/levels/parseLevel";

const GROUND_ROW = 12;
const MAX_JUMPABLE_GAP = 4; // tiles; a running jump covers about 5

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

describe.each(LEVEL_LAYOUTS)("level $name", (layout) => {
  it("parses, with the player and flag standing on ground", () => {
    const level = parseLevel(layout.rows);
    const solidBelow = (x: number, y: number) => layout.rows[y + 1]?.[x] === "#";
    expect(solidBelow(level.start.x, level.start.y)).toBe(true);
    expect(solidBelow(level.goal.x, level.goal.y)).toBe(true);
  });

  it("has no pit too wide to jump unless a platform crosses it", () => {
    const ground = layout.rows[GROUND_ROW];
    for (const match of ground.matchAll(/ +/g)) {
      const start = match.index!;
      const end = start + match[0].length;
      const bridged = layout.rows.some((row) => /[~-]/.test(row.slice(start, end)));
      if (!bridged) expect(match[0].length, `gap at column ${start}`).toBeLessThanOrEqual(MAX_JUMPABLE_GAP);
    }
  });
});

it("has a level layout for every lesson in every world", () => {
  for (const paper of LIBRARY) {
    for (const world of paper.worlds) expect(world.cutscenes.length).toBeLessThanOrEqual(LEVEL_LAYOUTS.length);
  }
});
