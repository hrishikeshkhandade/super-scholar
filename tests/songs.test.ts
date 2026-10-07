import { describe, expect, it } from "vitest";
import { SONGS, noteFrequency, steps } from "../src/audio/songs";

describe("noteFrequency", () => {
  it("converts note names to pitches", () => {
    expect(noteFrequency("A4")).toBeCloseTo(440);
    expect(noteFrequency("A5")).toBeCloseTo(880);
    expect(noteFrequency("C4")).toBeCloseTo(261.63, 1);
    expect(noteFrequency("F#4")).toBeCloseTo(noteFrequency("Gb4")!);
  });

  it("treats rests and junk as no note", () => {
    expect(noteFrequency(".")).toBeUndefined();
    expect(noteFrequency("H4")).toBeUndefined();
  });
});

const songs = Object.entries(SONGS).flatMap(([style, set]) =>
  Object.entries(set).map(([name, song]) => ({ label: `${style} ${name}`, song })),
);

describe.each(songs)("song $label", ({ song }) => {
  it("has the same number of steps in every voice, in whole bars", () => {
    const length = steps(song.lead).length;
    expect(length % 8).toBe(0);
    expect(steps(song.bass)).toHaveLength(length);
    expect(steps(song.drums)).toHaveLength(length);
  });

  it("only uses valid notes, rests, and drum hits", () => {
    for (const token of [...steps(song.lead), ...steps(song.bass)]) {
      expect(token === "." || noteFrequency(token) !== undefined, `bad note "${token}"`).toBe(true);
    }
    for (const hit of steps(song.drums)) expect(["k", "s", "h", "."]).toContain(hit);
  });
});
