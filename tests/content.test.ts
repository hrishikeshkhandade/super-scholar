import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { validatePaper } from "../src/content/validate";
import type { Paper } from "../src/content/types";

describe.each(LIBRARY)("paper $id", (paper) => {
  it("passes every content rule", () => {
    expect(validatePaper(paper)).toEqual([]);
  });
});

describe("the built-in paper", () => {
  const paper = LIBRARY[0];

  it("covers the whole paper in 5 complete worlds", () => {
    expect(paper.worlds.map((world) => world.name)).toEqual([
      "World 1: Pairs Trading",
      "World 2: Hunting Factors",
      "World 3: The S-Score",
      "World 4: Time Machine",
      "World 5: August 2007",
    ]);
    for (const world of paper.worlds) {
      expect(world.cutscenes, world.name).toHaveLength(3);
      expect(world.cutscenes.every((lesson) => lesson.practice), world.name).toBe(true);
      expect(world.boss.questions, world.name).toHaveLength(5);
      expect(world.facts.length, world.name).toBeGreaterThanOrEqual(5);
    }
  });

  it("gives every world its own boss", () => {
    expect(new Set(paper.worlds.map((world) => world.boss.name)).size).toBe(paper.worlds.length);
  });
});

describe("validatePaper", () => {
  const good = LIBRARY[0];
  const withBossQuestion = (question: Paper["worlds"][0]["boss"]["questions"][0]): Paper => ({
    ...good,
    worlds: [{ ...good.worlds[0], boss: { ...good.worlds[0].boss, questions: [question] } }],
  });

  it("catches a wrong answer index and duplicate choices", () => {
    const problems = validatePaper(
      withBossQuestion({ prompt: "Q?", choices: ["a", "A", "b"], answerIndex: 5, explanation: "" }),
    );
    expect(problems.join("\n")).toMatch(/answer index/);
    expect(problems.join("\n")).toMatch(/duplicate/);
  });

  it("catches facts and pages too long to fit on screen", () => {
    const tooLong = "x".repeat(300);
    const paper: Paper = {
      ...good,
      intro: { ...good.intro, pages: [tooLong] },
      worlds: [{ ...good.worlds[0], facts: [tooLong] }],
    };
    const problems = validatePaper(paper).join("\n");
    expect(problems).toMatch(/intro page 1/);
    expect(problems).toMatch(/fact 1/);
  });
});
