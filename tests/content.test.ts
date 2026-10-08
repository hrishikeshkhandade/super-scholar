import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { validatePaper } from "../src/content/validate";
import type { Paper } from "../src/content/types";

describe.each(LIBRARY)("paper $id", (paper) => {
  it("passes every content rule", () => {
    expect(validatePaper(paper)).toEqual([]);
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
