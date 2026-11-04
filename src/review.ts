import type { Paper } from "./content/types";
import { startLives, unlockNote } from "./save";
import type { StageData } from "./stage";

// Review mode, for players who've already read a paper: its boss fights back
// to back (or one section's), with no levels or lessons, then a score for
// each section so they know what to re-read.

export interface ReviewScore {
  worldIndex: number;
  rightFirstTry: number;
  total: number;
}

// A section with fewer than this share right on the first try is marked RE-READ.
const KNOWN_SHARE = 0.8;

export const needsRereading = (score: ReviewScore) => score.rightFirstTry < score.total * KNOWN_SHARE;

// A review in progress: the scores of the worlds done so far, and the last
// world it covers (the paper's last for ALL SECTIONS, or a single section's).
export interface Review {
  scores: ReviewScore[];
  lastWorld: number;
}

// A world's boss fight in a review. It never counts toward progress, the
// level map, or the leaderboard.
export function reviewStage(paper: Paper, worldIndex: number, review: Review): StageData {
  return {
    paper,
    worldIndex,
    checkpointsCleared: paper.worlds[worldIndex].cutscenes.length,
    lives: startLives(),
    replay: true,
    review,
  };
}

// Starts a review of one section, or of all of them when section is left out.
export function startReview(paper: Paper, section?: number): StageData {
  const first = section ?? 0;
  return reviewStage(paper, first, { scores: [], lastWorld: section ?? paper.worlds.length - 1 });
}

// REVIEW AGAIN: the same sections as the review these scores came from.
export function reviewAgain(paper: Paper, scores: ReviewScore[]): StageData {
  const first = scores[0].worldIndex;
  return reviewStage(paper, first, { scores: [], lastWorld: scores[scores.length - 1].worldIndex });
}

// RE-READ on the results opens a section's lessons in the Notebook. A
// reviewer skipped the levels that unlock them, so it unlocks them first.
export function unlockForRereading(paper: Paper, worldIndex: number, storage?: Storage): void {
  paper.worlds[worldIndex].cutscenes.forEach((_, i) => unlockNote(paper.id, worldIndex, "lesson", i, storage));
}
