import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import type { Question } from "../src/content/types";

// Catches broken content (a wrong answer index, an empty world) before a
// player runs into it mid-game.
function checkQuestion(question: Question) {
  expect(question.prompt.trim()).not.toBe("");
  expect(question.choices.length).toBeGreaterThanOrEqual(2);
  expect(question.choices.length).toBeLessThanOrEqual(4);
  expect(question.answerIndex).toBeGreaterThanOrEqual(0);
  expect(question.answerIndex).toBeLessThan(question.choices.length);
  expect(new Set(question.choices).size).toBe(question.choices.length);
}

describe.each(LIBRARY)("paper $id", (paper) => {
  it("has an intro and at least one world", () => {
    expect(paper.intro.pages.length).toBeGreaterThan(0);
    expect(paper.worlds.length).toBeGreaterThan(0);
  });

  it("has a valid cutscene, practice question, and boss in every world", () => {
    for (const world of paper.worlds) {
      expect(world.cutscenes.length).toBeGreaterThan(0);
      for (const cutscene of world.cutscenes) {
        expect(cutscene.pages.length).toBeGreaterThan(0);
        if (cutscene.practice) checkQuestion(cutscene.practice);
      }
      expect(world.boss.questions.length).toBeGreaterThan(0);
      world.boss.questions.forEach(checkQuestion);
    }
  });

  it("keeps cutscene pages short enough to fit the dialog box", () => {
    const pages = [paper.intro, ...paper.worlds.flatMap((world) => world.cutscenes)].flatMap((c) => c.pages);
    for (const page of pages) expect(page.length).toBeLessThanOrEqual(190);
  });
});
