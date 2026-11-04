import type { Paper } from "./content/types";
import { startLives } from "./save";
import type { StageData } from "./stage";

// Review mode, for players who've already read a paper: its boss fights back
// to back, with no levels or lessons, then a score for each section so they
// know what to re-read.

export interface ReviewScore {
  worldIndex: number;
  rightFirstTry: number;
  total: number;
}

// A section with fewer than this share right on the first try is marked RE-READ.
const KNOWN_SHARE = 0.8;

export const needsRereading = (score: ReviewScore) => score.rightFirstTry < score.total * KNOWN_SHARE;

// A world's boss fight in a review, carrying the scores of the worlds before it.
// It never counts toward progress, the level map, or the leaderboard.
export function reviewStage(paper: Paper, worldIndex: number, scores: ReviewScore[]): StageData {
  return {
    paper,
    worldIndex,
    checkpointsCleared: paper.worlds[worldIndex].cutscenes.length,
    lives: startLives(),
    replay: true,
    review: scores,
  };
}
