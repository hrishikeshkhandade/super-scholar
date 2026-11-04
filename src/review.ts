import type { Paper, Question } from "./content/types";
import { startLives, unlockNote, type Notebook } from "./save";
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

// A boss question by where it lives in the paper.
export interface MissedQuestion {
  worldIndex: number;
  questionIndex: number;
}

// A review in progress: the scores of the worlds done so far, and the last
// world it covers (the paper's last for ALL SECTIONS, or a single section's).
// missed is set for a MISSED QUESTIONS review: one fight asking only these.
export interface Review {
  scores: ReviewScore[];
  lastWorld: number;
  missed?: MissedQuestion[];
}

export const MISSED_PER_FIGHT = 8;

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

// The boss questions a player has gotten wrong on this paper (the Notebook's
// MISSED tags), oldest first.
export function missedQuestions(paper: Paper, notebook: Notebook): MissedQuestion[] {
  return (notebook[paper.id] ?? []).flatMap((entry) => {
    const [world, kind, index] = entry.split(":");
    const missed = { worldIndex: Number(world), questionIndex: Number(index) };
    return kind === "missed" && questionAt(paper, missed) ? [missed] : [];
  });
}

export const questionAt = (paper: Paper, missed: MissedQuestion): Question | undefined =>
  paper.worlds[missed.worldIndex]?.boss.questions[missed.questionIndex];

// One fight of up to MISSED_PER_FIGHT missed questions, in World 1's arena.
export function startMissedReview(paper: Paper, missed: MissedQuestion[]): StageData {
  return reviewStage(paper, 0, { scores: [], lastWorld: 0, missed: missed.slice(0, MISSED_PER_FIGHT) });
}

// A missed-questions fight's results, one row per section it drew from.
export function missedScores(missed: MissedQuestion[], wrongAgain: (question: MissedQuestion) => boolean): ReviewScore[] {
  const worlds = [...new Set(missed.map((question) => question.worldIndex))].sort((a, b) => a - b);
  return worlds.map((worldIndex) => {
    const fromWorld = missed.filter((question) => question.worldIndex === worldIndex);
    return { worldIndex, rightFirstTry: fromWorld.filter((question) => !wrongAgain(question)).length, total: fromWorld.length };
  });
}
