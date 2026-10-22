// The per-paper leaderboard's rules, shared by the game and the server:
// what a valid score and nickname are, and how scores are ranked.
//
// Ranked by knowledge (quiz answers right on the first try). Ties go to the
// faster run, but a time only counts when the run earned 3 stars on every
// level and boss; runs without one come after timed runs on the same score.

export const BOARD_SIZE = 10;
export const MIN_NAME_CHARS = 3;
export const MAX_NAME_CHARS = 12;
const MAX_QUESTIONS = 300;
const MIN_TIME_MS = 30_000;
const MAX_TIME_MS = 24 * 60 * 60 * 1000;
const PAPER_ID = /^[a-z0-9-]{1,80}$/;

export interface BoardEntry {
  name: string;
  score: number; // right on the first try
  total: number; // questions in the paper
  timeMs: number | null; // play time, only for all-3-star runs
  at: number; // when it was submitted, for ties
}

export interface Submission {
  paperId: string;
  name: string;
  score: number;
  total: number;
  timeMs: number | null;
}

// A light filter for a class game, not meant to catch everything. Only
// words that can't hide inside normal names (so "Cassie" or "Hancock" pass).
const BLOCKED_WORDS = ["fuck", "shit", "bitch", "cunt", "nigg", "slut", "whore", "porn", "nazi", "pussy", "faggot"];

export function nicknameProblem(name: string): string | undefined {
  const trimmed = name.trim();
  if (trimmed.length < MIN_NAME_CHARS || trimmed.length > MAX_NAME_CHARS) {
    return `Use ${MIN_NAME_CHARS}-${MAX_NAME_CHARS} letters or numbers.`;
  }
  if (!/^[A-Za-z0-9 _-]+$/.test(trimmed)) return "Only letters, numbers, spaces, - and _.";
  const squashed = trimmed.toLowerCase().replace(/[^a-z]/g, "");
  if (BLOCKED_WORDS.some((word) => squashed.includes(word))) return "Please pick a different nickname.";
  return undefined;
}

export const isPaperId = (id: unknown): id is string => typeof id === "string" && PAPER_ID.test(id);

export function parseSubmission(body: unknown): Submission | undefined {
  const value = (body ?? {}) as Record<string, unknown>;
  const { paperId, name, score, total, timeMs } = value;
  if (!isPaperId(paperId) || typeof name !== "string" || nicknameProblem(name)) return undefined;
  if (!Number.isInteger(total) || (total as number) < 1 || (total as number) > MAX_QUESTIONS) return undefined;
  if (!Number.isInteger(score) || (score as number) < 0 || (score as number) > (total as number)) return undefined;
  const timed = timeMs === null || (Number.isInteger(timeMs) && (timeMs as number) >= MIN_TIME_MS && (timeMs as number) <= MAX_TIME_MS);
  if (!timed) return undefined;
  return { paperId, name: name.trim(), score: score as number, total: total as number, timeMs: timeMs as number | null };
}

// Best first: higher score, then a counted time before none, then faster,
// then whoever got there first.
export function compareEntries(a: BoardEntry, b: BoardEntry): number {
  if (a.score !== b.score) return b.score - a.score;
  if ((a.timeMs === null) !== (b.timeMs === null)) return a.timeMs === null ? 1 : -1;
  if (a.timeMs !== null && b.timeMs !== null && a.timeMs !== b.timeMs) return a.timeMs - b.timeMs;
  return a.at - b.at;
}

// "12:05" or "1:02:05".
export function formatTime(ms: number | null): string {
  if (ms === null) return "-";
  const seconds = Math.round(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return h > 0 ? `${h}:${pad(m)}:${pad(seconds % 60)}` : `${m}:${pad(seconds % 60)}`;
}
