import type { MusicStyle } from "./audio/songs";
import type { Paper } from "./content/types";
import { DIFFICULTIES, TUNING, type Difficulty } from "./difficulty";
import { validatePaper } from "./content/validate";

// Saves progress and settings in the browser (localStorage), so "Continue"
// works after closing the tab. Every access is guarded: storage can be
// missing or blocked (private windows), and the game must still run.

export interface Progress {
  paperId: string;
  worldIndex: number;
  checkpointsCleared: number;
}

export type TextSpeed = "slow" | "normal" | "fast";

export interface Settings {
  textSpeed: TextSpeed;
  musicVolume: number; // 0 (off) to 100, in VOLUME_LEVELS steps
  musicStyle: MusicStyle;
  sfxVolume: number;
  difficulty: Difficulty;
}

export const MUSIC_STYLES: MusicStyle[] = ["upbeat", "tradingFloor"];

export const TEXT_SPEED_MS: Record<TextSpeed, number> = { slow: 45, normal: 25, fast: 8 };
export const TEXT_SPEEDS: TextSpeed[] = ["slow", "normal", "fast"];

const PROGRESS_KEY = "super-scholar.progress";
const SETTINGS_KEY = "super-scholar.settings";
const UPLOADS_KEY = "super-scholar.uploads";
const NOTEBOOK_KEY = "super-scholar.notebook";
const CLEARED_KEY = "super-scholar.cleared";
const STARS_KEY = "super-scholar.stars";
const MAX_SAVED_UPLOADS = 3;
// 100% is the game's original loudness.
export const VOLUME_LEVELS = [0, 25, 50, 75, 100];
const DEFAULT_SETTINGS: Settings = { textSpeed: "normal", musicVolume: 100, musicStyle: "upbeat", sfxVolume: 100, difficulty: "normal" };

// A saved volume, or an on/off switch from saves made before volume levels.
function volumeFrom(value: unknown, legacySwitch: unknown, fallback: number): number {
  if (VOLUME_LEVELS.includes(value as number)) return value as number;
  if (typeof legacySwitch === "boolean") return legacySwitch ? 100 : 0;
  return fallback;
}

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : undefined;
  } catch {
    return undefined;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the game keeps working, it just won't remember.
  }
}

function isProgress(value: unknown): value is Progress {
  const v = value as Progress;
  return (
    typeof v === "object" &&
    v !== null &&
    typeof v.paperId === "string" &&
    Number.isInteger(v.worldIndex) &&
    v.worldIndex >= 0 &&
    Number.isInteger(v.checkpointsCleared) &&
    v.checkpointsCleared >= 0
  );
}

export function loadProgress(storage: Storage | null = browserStorage()): Progress | undefined {
  const value = readJson(storage, PROGRESS_KEY);
  return isProgress(value) ? value : undefined;
}

export function saveProgress(progress: Progress, storage: Storage | null = browserStorage()): void {
  writeJson(storage, PROGRESS_KEY, progress);
}

// Moves the saved place forward, never back, so replaying an earlier level
// from the level select doesn't rewind CONTINUE. Playing a different paper
// makes that paper the one to continue.
export function advanceProgress(progress: Progress, storage: Storage | null = browserStorage()): void {
  const current = loadProgress(storage);
  const alreadyFurther =
    current?.paperId === progress.paperId &&
    (current.worldIndex > progress.worldIndex ||
      (current.worldIndex === progress.worldIndex && current.checkpointsCleared >= progress.checkpointsCleared));
  if (!alreadyFurther) saveProgress(progress, storage);
}

// Erases where the player is and which levels they've cleared (the
// notebook is kept: it's what they learned).
export function clearProgress(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(PROGRESS_KEY);
    storage?.removeItem(CLEARED_KEY);
    storage?.removeItem(STARS_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function loadSettings(storage: Storage | null = browserStorage()): Settings {
  const value = (readJson(storage, SETTINGS_KEY) ?? {}) as Partial<Settings> & { music?: unknown; sfx?: unknown };
  return {
    textSpeed: TEXT_SPEEDS.includes(value.textSpeed!) ? value.textSpeed! : DEFAULT_SETTINGS.textSpeed,
    musicVolume: volumeFrom(value.musicVolume, value.music, DEFAULT_SETTINGS.musicVolume),
    musicStyle: MUSIC_STYLES.includes(value.musicStyle!) ? value.musicStyle! : DEFAULT_SETTINGS.musicStyle,
    sfxVolume: volumeFrom(value.sfxVolume, value.sfx, DEFAULT_SETTINGS.sfxVolume),
    difficulty: DIFFICULTIES.includes(value.difficulty!) ? value.difficulty! : DEFAULT_SETTINGS.difficulty,
  };
}

// The numbers for the chosen difficulty, read when a level or boss starts.
export const currentTuning = (storage: Storage | null = browserStorage()) => TUNING[loadSettings(storage).difficulty];

// Hearts at the start of a world, a retry, or a continue.
export const startLives = (storage: Storage | null = browserStorage()) => currentTuning(storage).startLives;

export function saveSettings(settings: Settings, storage: Storage | null = browserStorage()): void {
  writeJson(storage, SETTINGS_KEY, settings);
}

// Games made from uploaded PDFs, newest first, so they can be continued later.
export function loadUploadedPapers(storage: Storage | null = browserStorage()): Paper[] {
  const value = readJson(storage, UPLOADS_KEY);
  if (!Array.isArray(value)) return [];
  return value.filter((paper): paper is Paper => {
    try {
      return validatePaper(paper as Paper).length === 0;
    } catch {
      return false; // not shaped like a paper at all
    }
  });
}

export function saveUploadedPaper(paper: Paper, storage: Storage | null = browserStorage()): void {
  const others = loadUploadedPapers(storage).filter((saved) => saved.id !== paper.id);
  writeJson(storage, UPLOADS_KEY, [paper, ...others].slice(0, MAX_SAVED_UPLOADS));
}

// Lists of short entries kept per paper (the notebook, cleared levels).
// Entries that don't match the expected pattern are dropped on load, so
// edited or corrupted storage can't inject anything odd.
type ListsByPaper = Record<string, string[]>;

function loadLists(key: string, pattern: RegExp, storage: Storage | null): ListsByPaper {
  const value = readJson(storage, key);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const lists: ListsByPaper = {};
  for (const [paperId, entries] of Object.entries(value)) {
    if (!Array.isArray(entries)) continue;
    lists[paperId] = entries.filter((entry): entry is string => typeof entry === "string" && pattern.test(entry));
  }
  return lists;
}

function addToList(key: string, pattern: RegExp, paperId: string, entry: string, storage: Storage | null): void {
  const lists = loadLists(key, pattern, storage);
  const entries = lists[paperId] ?? [];
  if (entries.includes(entry)) return;
  lists[paperId] = [...entries, entry];
  writeJson(storage, key, lists);
}

// The Scholar's Notebook: what the player has unlocked in each paper, kept
// as entries like "0:lesson:2" (world 0, lesson 2). It is separate from
// progress, so resetting progress keeps everything already learned.

// "missed" marks a boss question the player once got wrong.
export type NoteKind = "lesson" | "fact" | "boss" | "missed";
export type Notebook = Record<string, string[]>;

const NOTE_PATTERN = /^\d{1,3}:(lesson|fact|boss|missed):\d{1,3}$/;

export const noteKey = (worldIndex: number, kind: NoteKind, index: number) => `${worldIndex}:${kind}:${index}`;

export function loadNotebook(storage: Storage | null = browserStorage()): Notebook {
  return loadLists(NOTEBOOK_KEY, NOTE_PATTERN, storage);
}

export function unlockNote(
  paperId: string,
  worldIndex: number,
  kind: NoteKind,
  index: number,
  storage: Storage | null = browserStorage(),
): void {
  addToList(NOTEBOOK_KEY, NOTE_PATTERN, paperId, noteKey(worldIndex, kind, index), storage);
}

// Levels and bosses the player has beaten, per paper: "0:1" is level 1-2,
// "0:boss" is World 1's boss. The level select lights these up.
export type ClearedStages = Record<string, string[]>;
export type Stage = number | "boss";

const CLEARED_PATTERN = /^\d{1,3}:(\d{1,3}|boss)$/;

export const stageKey = (worldIndex: number, stage: Stage) => `${worldIndex}:${stage}`;

export function loadCleared(storage: Storage | null = browserStorage()): ClearedStages {
  return loadLists(CLEARED_KEY, CLEARED_PATTERN, storage);
}

export function markCleared(paperId: string, worldIndex: number, stage: Stage, storage: Storage | null = browserStorage()): void {
  addToList(CLEARED_KEY, CLEARED_PATTERN, paperId, stageKey(worldIndex, stage), storage);
}

// Best star rating (1-3) for each level and boss, per paper, keyed like the
// cleared list ("0:1", "0:boss").
export type StarRecords = Record<string, Record<string, number>>;

const isStarCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 1 && (value as number) <= 3;

export function loadStars(storage: Storage | null = browserStorage()): StarRecords {
  const value = readJson(storage, STARS_KEY);
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const records: StarRecords = {};
  for (const [paperId, stages] of Object.entries(value)) {
    if (typeof stages !== "object" || stages === null || Array.isArray(stages)) continue;
    records[paperId] = Object.fromEntries(
      Object.entries(stages).filter((entry): entry is [string, number] => CLEARED_PATTERN.test(entry[0]) && isStarCount(entry[1])),
    );
  }
  return records;
}

// Keeps the better of the old and new rating, so replays can only raise it.
export function saveBestStars(
  paperId: string,
  worldIndex: number,
  stage: Stage,
  stars: number,
  storage: Storage | null = browserStorage(),
): void {
  if (!isStarCount(stars)) return;
  const records = loadStars(storage);
  const paperStars = records[paperId] ?? {};
  const key = stageKey(worldIndex, stage);
  if ((paperStars[key] ?? 0) >= stars) return;
  records[paperId] = { ...paperStars, [key]: stars };
  writeJson(storage, STARS_KEY, records);
}
