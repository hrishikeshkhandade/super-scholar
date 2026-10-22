import type { Paper } from "./content/types";
import { browserStorage, readJson, stageKey, writeJson, type Stage, type Storage } from "./save";

// A run is one full playthrough of a paper, from starting it to PAPER
// COMPLETE, for the leaderboard. It's saved as it goes, so closing the tab
// and pressing CONTINUE keeps it. Replays from the level select don't count.

const RUN_KEY = "super-scholar.run";

export interface Run {
  paperId: string;
  answers: Record<string, boolean>; // question -> right on the first try
  stars: Record<string, number>; // level or boss -> stars earned this run
  playMs: number; // time in levels and boss fights (not lessons or questions)
  finished?: boolean; // reached PAPER COMPLETE; ready to go on the leaderboard
}

export interface RunResult {
  score: number;
  total: number;
  timeMs: number | null; // only when every level and boss got 3 stars
}

// Which question it was, so answering it again later never changes the score.
export const practiceKey = (worldIndex: number, lesson: number) => `${worldIndex}:${lesson}:practice`;
export const bossQuestionKey = (worldIndex: number, question: number) => `${worldIndex}:boss:${question}`;

export function startRun(paperId: string, storage: Storage | null = browserStorage()): void {
  writeJson(storage, RUN_KEY, { paperId, answers: {}, stars: {}, playMs: 0 } satisfies Run);
}

export function loadRun(paperId: string, storage: Storage | null = browserStorage()): Run | undefined {
  const run = readJson(storage, RUN_KEY) as Run | undefined;
  const valid =
    run !== undefined &&
    run !== null &&
    run.paperId === paperId &&
    typeof run.answers === "object" &&
    typeof run.stars === "object" &&
    Number.isFinite(run.playMs);
  return valid ? run : undefined;
}

function update(paperId: string, change: (run: Run) => void, storage: Storage | null): void {
  const run = loadRun(paperId, storage);
  if (!run) return;
  change(run);
  writeJson(storage, RUN_KEY, run);
}

// Only the first answer to each question counts.
export function recordAnswer(paperId: string, question: string, correct: boolean, storage: Storage | null = browserStorage()): void {
  update(paperId, (run) => (run.answers[question] ??= correct), storage);
}

export function recordStars(paperId: string, worldIndex: number, stage: Stage, stars: number, storage: Storage | null = browserStorage()): void {
  update(paperId, (run) => (run.stars[stageKey(worldIndex, stage)] = stars), storage);
}

export function addPlayTime(paperId: string, ms: number, storage: Storage | null = browserStorage()): void {
  if (ms > 0) update(paperId, (run) => (run.playMs += ms), storage);
}

export function finishRun(paperId: string, storage: Storage | null = browserStorage()): void {
  update(paperId, (run) => (run.finished = true), storage);
}

// A finished run waiting to be put on this paper's leaderboard, if any.
export function finishedRun(paperId: string, storage: Storage | null = browserStorage()): Run | undefined {
  const run = loadRun(paperId, storage);
  return run?.finished ? run : undefined;
}

// Once submitted, the run is over.
export function endRun(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(RUN_KEY);
  } catch {
    // Blocked storage: nothing to clear.
  }
}

export function runResult(paper: Paper, run: Run): RunResult {
  const total = paper.worlds.reduce((sum, world) => sum + world.cutscenes.filter((c) => c.practice).length + world.boss.questions.length, 0);
  const score = Object.values(run.answers).filter(Boolean).length;
  const stages = paper.worlds.flatMap((world, w) => [...world.cutscenes.map((_, c) => stageKey(w, c)), stageKey(w, "boss")]);
  const allThreeStars = stages.every((key) => run.stars[key] === 3);
  return { score: Math.min(score, total), total, timeMs: allThreeStars ? Math.round(run.playMs) : null };
}
