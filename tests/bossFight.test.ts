import { describe, expect, it } from "vitest";
import { BossFight } from "../src/bossFight";
import type { Question } from "../src/content/types";

const question = (prompt: string, answerIndex = 0): Question => ({
  prompt,
  choices: ["a", "b", "c", "d"],
  answerIndex,
  explanation: "",
});

describe("BossFight", () => {
  it("loses boss health on a right answer", () => {
    const fight = new BossFight([question("q1"), question("q2")], 3);
    expect(fight.answer(0)).toBe(true);
    expect(fight.health).toBe(1);
    expect(fight.lives).toBe(3);
  });

  it("costs a life on a wrong answer and asks that question again later", () => {
    const fight = new BossFight([question("q1"), question("q2")], 3);
    expect(fight.answer(1)).toBe(false);
    expect(fight.lives).toBe(2);
    expect(fight.current?.prompt).toBe("q2");
    fight.answer(0);
    expect(fight.current?.prompt).toBe("q1");
  });

  it("is won when every question is answered correctly", () => {
    const fight = new BossFight([question("q1")], 1);
    fight.answer(0);
    expect(fight.outcome).toBe("won");
    expect(fight.current).toBeUndefined();
  });

  it("is lost when lives run out, and ignores further answers", () => {
    const fight = new BossFight([question("q1"), question("q2")], 1);
    fight.answer(3);
    expect(fight.outcome).toBe("lost");
    expect(fight.answer(0)).toBe(false);
    expect(fight.health).toBe(2);
  });
});
