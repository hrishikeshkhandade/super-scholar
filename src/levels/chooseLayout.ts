import { hashString } from "../generator/questions";
import { NES } from "../palette";
import { generateLayout } from "./generateLayout";
import { LEVEL_LAYOUTS, type LevelLayout } from "./layouts";

// World 1 of every paper uses the hand-made levels; later worlds get
// generated ones that get harder world by world. Seeding by paper means a
// paper's levels are the same every time it's played.
export function layoutFor(paperId: string, worldIndex: number, levelIndex: number): LevelLayout {
  if (worldIndex === 0) return LEVEL_LAYOUTS[levelIndex % LEVEL_LAYOUTS.length];
  const difficulty = Math.min(0.35 + worldIndex * 0.15 + levelIndex * 0.08, 1);
  return generateLayout(hashString(`${paperId}:${worldIndex}:${levelIndex}`), difficulty);
}

export interface Theme {
  sky: number;
  skylineAlpha: number;
  cloudAlpha: number;
}

// Each world has its own time of day, so moving on feels like progress.
export const THEMES: Theme[] = [
  { sky: NES.sky, skylineAlpha: 1, cloudAlpha: 1 }, // day
  { sky: NES.tan, skylineAlpha: 1, cloudAlpha: 0.8 }, // sunset
  { sky: NES.purple, skylineAlpha: 0.9, cloudAlpha: 0.5 }, // dusk
  { sky: NES.navy, skylineAlpha: 0.8, cloudAlpha: 0.2 }, // night
];

export function themeFor(worldIndex: number): Theme {
  return THEMES[worldIndex % THEMES.length];
}
