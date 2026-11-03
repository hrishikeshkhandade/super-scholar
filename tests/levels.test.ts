import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { layoutFor } from "../src/levels/chooseLayout";
import { LEVELS_PER_WORLD, TUTORIAL_LAYOUT } from "../src/levels/layouts";
import { THEMES, themeFor } from "../src/levels/themes";
import { parseLevel } from "../src/levels/parseLevel";
import { layoutProblems } from "../src/levels/validateLayout";

describe("parseLevel", () => {
  it("finds the start, goal, and each kind of tile", () => {
    const level = parseLevel(["  o u", " ?H- ", "P b F", "#####"]);
    expect(level.start).toEqual({ x: 0, y: 2 });
    expect(level.goal).toEqual({ x: 4, y: 2 });
    expect(level.coins).toEqual([{ x: 2, y: 0 }]);
    expect(level.bubbles).toEqual([{ x: 4, y: 0 }]);
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
    expect(layoutProblems(rows("##        ##")).join()).toMatch(/can't be reached/);
  });

  // The level's art, rows 5 to 11 (above the ground), then the ground row.
  const level = (art: string[], ground: string) => {
    const width = ground.length;
    const blank = " ".repeat(width);
    const body = [...Array(5).fill(blank), ...art];
    body[11] = "P" + body[11].slice(1, -1) + "F";
    return [...body, ground, ground];
  };

  it("allows a 5-tile pit, which takes a running jump, but not 6", () => {
    expect(layoutProblems(rows("##     ##"))).toEqual([]);
    expect(layoutProblems(rows("##      ##")).join()).toMatch(/can't be reached/);
  });

  it("rejects a wall too tall to jump, unless ledges lead up to it", () => {
    // A wall 5 tiles tall; the jump rises less than 5.
    const tall = level(["            ", "            ", "      ##    ", "      ##    ", "      ##    ", "      ##    ", "      ##    "], "############");
    expect(layoutProblems(tall).join()).toMatch(/can't be reached/);
    const ledge = level(["            ", "            ", "      ##    ", "      ##    ", "  --  ##    ", "      ##    ", "      ##    "], "############");
    expect(layoutProblems(ledge)).toEqual([]);
  });

  it("can't stand on candle spikes, so a long spike bed needs a way over", () => {
    const blank = " ".repeat(12);
    const spikes = level([blank, blank, blank, blank, blank, blank, "  ^^^^^^^   "], "############");
    expect(layoutProblems(spikes).join()).toMatch(/can't be reached/);
    const bridged = level([blank, blank, blank, blank, "   --  --   ", blank, "  ^^^^^^^   "], "############");
    expect(layoutProblems(bridged)).toEqual([]);
  });

  it("flags a player or flag floating over a pit", () => {
    expect(layoutProblems(rows(" ######## ")).join()).toMatch(/start|flag/);
  });
});

it("the hand-made tutorial level is beatable", () => {
  expect(layoutProblems(TUTORIAL_LAYOUT.rows)).toEqual([]);
});

it("has a level for every lesson in the built-in papers", () => {
  for (const paper of LIBRARY) {
    for (const world of paper.worlds) expect(world.cutscenes.length).toBeLessThanOrEqual(LEVELS_PER_WORLD);
  }
});

describe("level variety", () => {
  it("starts the built-in paper with the tutorial and generates every other level", () => {
    expect(layoutFor(LIBRARY[0].id, 0, 0)).toBe(TUTORIAL_LAYOUT);
    expect(layoutFor(LIBRARY[0].id, 0, 1)).not.toBe(TUTORIAL_LAYOUT);
    expect(layoutFor("upload-123", 0, 0)).not.toBe(TUTORIAL_LAYOUT);
  });

  it("gives every level of a paper its own map, and different papers different maps", () => {
    const maps = new Set<string>();
    for (const paper of ["upload-a", "upload-b"]) {
      for (let world = 0; world < 5; world++) {
        for (let level = 0; level < 3; level++) maps.add(layoutFor(paper, world, level).rows.join("\n"));
      }
    }
    expect(maps.size).toBe(30);
  });

  it("never shows the same background theme twice in a row", () => {
    for (let world = 0; world < 5; world++) {
      for (let level = 0; level < 3; level++) {
        const next = level < 2 ? themeFor(7, world, level + 1) : themeFor(7, world + 1, 0);
        expect(next).not.toBe(themeFor(7, world, level));
      }
    }
    expect(new Set(THEMES.map((theme) => theme.name)).size).toBe(THEMES.length);
  });
});
