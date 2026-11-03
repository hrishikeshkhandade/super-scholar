import { HAND_WRITTEN_PAPER_ID } from "../content/library";
import { hashString } from "../generator/questions";
import { CHALLENGE_KINDS, generateLayout } from "./generateLayout";
import { TUTORIAL_LAYOUT, type LevelLayout } from "./layouts";

// The hand-written paper starts with the hand-made tutorial level; every other
// level is generated, seeded by paper so each paper has its own maps and
// they're the same every time.
//
// Difficulty starts mid-way in World 1 (so even the first levels ask for real
// jumps) and climbs with each level and world; HARD mode adds extraDifficulty.
// Each level must include two kinds of challenge, rotating so a world's first
// two levels cover all four between them.
export function layoutFor(paperId: string, worldIndex: number, levelIndex: number, extraDifficulty = 0): LevelLayout {
  if (paperId === HAND_WRITTEN_PAPER_ID && worldIndex === 0 && levelIndex === 0) return TUTORIAL_LAYOUT;
  const difficulty = Math.min(0.35 + worldIndex * 0.15 + levelIndex * 0.08 + extraDifficulty, 1);
  const required = [CHALLENGE_KINDS[(levelIndex * 2) % 4], CHALLENGE_KINDS[(levelIndex * 2 + 1) % 4]];
  return generateLayout(hashString(`${paperId}:${worldIndex}:${levelIndex}`), difficulty, required);
}
