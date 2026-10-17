import { describe, expect, it } from "vitest";
import { BossFight, MAX_RAGE } from "../src/bossFight";
import type { Question } from "../src/content/types";

const question = (prompt: string, answerIndex = 0): Question => ({
  prompt,
  choices: ["a", "b", "c", "d"],
  answerIndex,
  explanation: "",
});

describe("BossFight", () => {
  it("loses boss health on a right answer", () => {
    const fight = new BossFight([question("q1"), question("q2")]);
    expect(fight.answer(0)).toBe(true);
    expect(fight.health).toBe(1);
    expect(fight.rage).toBe(0);
  });

  it("enrages the boss on a wrong answer and asks that question again later", () => {
    const fight = new BossFight([question("q1"), question("q2")]);
    expect(fight.answer(1)).toBe(false);
    expect(fight.health).toBe(2);
    expect(fight.rage).toBe(1);
    expect(fight.current?.prompt).toBe("q2");
    fight.answer(0);
    expect(fight.current?.prompt).toBe("q1");
  });

  it("caps rage so the boss can't get impossibly fast", () => {
    const fight = new BossFight([question("q1")]);
    for (let i = 0; i < 10; i++) fight.answer(3);
    expect(fight.rage).toBe(MAX_RAGE);
  });

  it("is defeated when every question is answered correctly, and ignores further answers", () => {
    const fight = new BossFight([question("q1")]);
    fight.answer(0);
    expect(fight.defeated).toBe(true);
    expect(fight.current).toBeUndefined();
    expect(fight.answer(0)).toBe(false);
    expect(fight.health).toBe(0);
  });

  it("remembers each missed question once, in the order missed", () => {
    const q1 = { prompt: "One?", choices: ["a", "b"], answerIndex: 0, explanation: "" };
    const q2 = { prompt: "Two?", choices: ["a", "b"], answerIndex: 1, explanation: "" };
    const fight = new BossFight([q1, q2]);
    // A missed question goes to the back of the line.
    fight.answer(1); // q1 wrong -> [q2, q1]
    fight.answer(0); // q2 wrong -> [q1, q2]
    fight.answer(1); // q1 wrong again -> [q2, q1]
    fight.answer(1); // q2 right -> [q1]
    fight.answer(0); // q1 right
    expect(fight.defeated).toBe(true);
    expect(fight.missed).toEqual([q1, q2]);
    expect(fight.wrongAnswers).toBe(3);
  });
});

