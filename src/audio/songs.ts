// Music written as text. Each token is one eighth note: a note name like
// "C5", "F#4" or "Bb2", or "." for a rest. Drums use k (kick), s (snare),
// and h (hi-hat). Every voice in a song has the same number of steps.

export type MusicStyle = "upbeat" | "tradingFloor";
export type SongName = "title" | "level" | "boss";

export interface Song {
  bpm: number;
  lead: string;
  bass: string;
  drums: string;
}

const repeat = (pattern: string, times: number) => Array(times).fill(pattern).join(" ");

export const SONGS: Record<MusicStyle, Record<SongName, Song>> = {
  upbeat: {
    title: {
      bpm: 140,
      lead: "E5 . G5 . C6 . G5 . A5 . F5 . A5 . C6 . G5 . E5 . C5 . E5 . D5 . G5 . B4 . D5 .",
      bass: "C3 . G3 . C3 . G3 . F3 . C4 . F3 . C4 . E3 . B3 . A3 . E3 . G3 . D3 . G3 . B3 .",
      drums: repeat("k . h . s . h .", 4),
    },
    level: {
      bpm: 160,
      lead: [
        "E5 . E5 . G5 . E5 .",
        "C5 . D5 . E5 . . .",
        "F5 . F5 . A5 . F5 .",
        "E5 . D5 . C5 . . .",
        "G5 . A5 . G5 . E5 .",
        "C6 . B5 . A5 . G5 .",
        "F5 . E5 . D5 . E5 .",
        "C5 . . . G4 . . .",
      ].join(" "),
      bass: [
        "C3 . G3 . C3 . G3 .",
        "C3 . G3 . C3 . E3 .",
        "F3 . C4 . F3 . C4 .",
        "C3 . G3 . C3 . G3 .",
        "E3 . B3 . E3 . B3 .",
        "A3 . E3 . A3 . E3 .",
        "F3 . C4 . G3 . D4 .",
        "C3 . G3 . C3 . . .",
      ].join(" "),
      drums: repeat("k . h . s . h k", 8),
    },
    boss: {
      bpm: 170,
      lead: [
        "A4 C5 E5 A5 G5 E5 C5 E5",
        "F4 A4 C5 F5 E5 C5 A4 C5",
        "G4 B4 D5 G5 F5 D5 B4 D5",
        "E4 G#4 B4 E5 G#5 E5 B4 G#4",
      ].join(" "),
      bass: [
        "A2 . A2 A3 A2 . A2 A3",
        "F2 . F2 F3 F2 . F2 F3",
        "G2 . G2 G3 G2 . G2 G3",
        "E2 . E2 E3 E2 . E2 E3",
      ].join(" "),
      drums: repeat("k h s h k k s h", 4),
    },
  },
  tradingFloor: {
    title: {
      bpm: 120,
      lead: [
        "D5 . . F5 . . A5 .",
        "G5 . F5 . E5 . . .",
        "D5 . . F5 . . C6 .",
        "A5 . . . . . . .",
      ].join(" "),
      bass: [
        "D2 D2 D3 D2 D2 D2 D3 D2",
        "A1 A1 A2 A1 A1 A1 A2 A1",
        "Bb1 Bb1 Bb2 Bb1 Bb1 Bb1 Bb2 Bb1",
        "A1 A1 A2 A1 C2 C2 C#2 C#2",
      ].join(" "),
      drums: repeat("k . h . k . h h", 4),
    },
    level: {
      bpm: 132,
      lead: [
        "E5 . G5 . B5 . A5 G5",
        "F#5 . . . D5 . . .",
        "E5 . G5 . B5 . D6 B5",
        "C6 . . . A5 . . .",
        "G5 . F#5 . E5 . D5 .",
        "C5 . D5 . E5 . . .",
        "B4 . C5 . D5 . F#5 .",
        "E5 . . . . . . .",
      ].join(" "),
      bass: [
        "E2 E2 E3 E2 E2 E2 E3 E2",
        "D2 D2 D3 D2 D2 D2 D3 D2",
        "E2 E2 E3 E2 E2 E2 E3 E2",
        "C2 C2 C3 C2 C2 C2 C3 C2",
        "C2 C2 C3 C2 C2 C2 C3 C2",
        "A1 A1 A2 A1 A1 A1 A2 A1",
        "B1 B1 B2 B1 B1 B1 B2 B1",
        "E2 E2 E3 E2 B1 B1 D#2 D#2",
      ].join(" "),
      drums: repeat("k h h h s h h k", 8),
    },
    boss: {
      bpm: 150,
      lead: [
        "C5 . C5 Eb5 . C5 G5 .",
        "Gb5 . F5 . Eb5 . D5 .",
        "C5 . C5 Eb5 . C5 Ab5 .",
        "G5 . . . G4 . . .",
      ].join(" "),
      bass: [
        "C2 C3 C2 C3 C2 C3 C2 C3",
        "Ab1 Ab2 Ab1 Ab2 Ab1 Ab2 Ab1 Ab2",
        "F1 F2 F1 F2 F1 F2 F1 F2",
        "G1 G2 G1 G2 B1 B2 B1 B2",
      ].join(" "),
      drums: repeat("k h s h k k s h", 4),
    },
  },
};

const SEMITONES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// "A4" -> 440. Returns undefined for a rest or anything that isn't a note.
export function noteFrequency(note: string): number | undefined {
  const match = /^([A-G])([#b]?)(-?\d)$/.exec(note);
  if (!match) return undefined;
  const [, letter, accidental, octave] = match;
  const offset = accidental === "#" ? 1 : accidental === "b" ? -1 : 0;
  const midi = 12 * (Number(octave) + 1) + SEMITONES[letter] + offset;
  return 440 * 2 ** ((midi - 69) / 12);
}

export function steps(voice: string): string[] {
  return voice.split(/\s+/).filter((token) => token.length > 0);
}
