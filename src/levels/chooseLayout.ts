import { LIBRARY } from "../content/library";
import { hashString } from "../generator/questions";
import { generateLayout } from "./generateLayout";
import { LEVEL_LAYOUTS, type LevelLayout } from "./layouts";

// Built-in papers play the hand-made levels in World 1; everything else
// (generated papers, later worlds) gets generated levels, seeded by paper so
// each paper has its own maps and they're the same every time.
export function layoutFor(paperId: string, worldIndex: number, levelIndex: number): LevelLayout {
  const handMade = LIBRARY.some((paper) => paper.id === paperId);
  if (handMade && worldIndex === 0) return LEVEL_LAYOUTS[levelIndex % LEVEL_LAYOUTS.length];
  const difficulty = Math.min(0.1 + worldIndex * 0.12 + levelIndex * 0.06, 1);
  return generateLayout(hashString(`${paperId}:${worldIndex}:${levelIndex}`), difficulty);
}
