import { describe, expect, it } from "vitest";
import RECORDED from "../public/tutorial/lines.json";
import { TUTORIAL_STEPS, lineFor, spokenText, voiceFile, voiceLines } from "../src/tutorial";

// The recordings in the game's files (listed, not loaded).
const RECORDINGS = Object.keys(import.meta.glob("../public/tutorial/*.mp3")).map((path) => path.replace("../public/", ""));

describe("the professor's tour", () => {
  it("has a recording of every line, saying exactly what the line says", () => {
    for (const line of voiceLines()) {
      // A changed line needs recording again: scripts/recordTutorial.py.
      expect((RECORDED as Record<string, string>)[line.id], line.id).toBe(line.text);
      expect(RECORDINGS).toContain(voiceFile(line.id));
    }
    expect(Object.keys(RECORDED).sort()).toEqual(voiceLines().map((line) => line.id).sort());
  });

  it("gives every step its own name", () => {
    const ids = TUTORIAL_STEPS.map((step) => step.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("speaks menu names as words, abbreviations and keys as letters", () => {
    expect(spokenText("NEW GAME lets you upload your own PDF.")).toBe("new game lets you upload your own PDF.");
    expect(spokenText("Press A and D to run, and W or Space to jump.")).toBe("Press Eigh and D to run, and W or Space to jump.");
    // A sentence starting with the word "A" keeps it.
    expect(spokenText("A wrong answer. A bear!")).toBe("A wrong answer. A bear!");
  });

  it("shows phones the touch wording where a step has one", () => {
    const controls = TUTORIAL_STEPS.find((step) => step.id === "controls")!;
    expect(lineFor(controls, true)).toEqual({ id: "controls-touch", text: controls.touchText });
    expect(lineFor(controls, false)).toEqual({ id: "controls", text: controls.text });
    const welcome = TUTORIAL_STEPS[0];
    expect(lineFor(welcome, true).id).toBe("welcome");
  });
});
