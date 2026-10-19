import { HAND_WRITTEN_PAPER_ID } from "../content/library";
import { hashString } from "../generator/questions";
import { generateLayout } from "./generateLayout";
import { LEVEL_LAYOUTS, type LevelLayout } from "./layouts";

// The hand-written paper plays the hand-made levels in World 1; everything
// else (showcase and uploaded papers, later worlds) gets generated levels, seeded by paper so
// each paper has its own maps and they're the same every time.
export function layoutFor(paperId: string, worldIndex: number, levelIndex: number): LevelLayout {
  if (paperId === HAND_WRITTEN_PAPER_ID && worldIndex === 0) return LEVEL_LAYOUTS[levelIndex % LEVEL_LAYOUTS.length];
  const difficulty = Math.min(0.1 + worldIndex * 0.12 + levelIndex * 0.06, 1);
  return generateLayout(hashString(`${paperId}:${worldIndex}:${levelIndex}`), difficulty);
}
