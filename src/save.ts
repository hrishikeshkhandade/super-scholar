import type { MusicStyle } from "./audio/songs";
import type { Paper } from "./content/types";
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
  music: boolean;
  musicStyle: MusicStyle;
  sfx: boolean;
}

export const MUSIC_STYLES: MusicStyle[] = ["upbeat", "tradingFloor"];

export const TEXT_SPEED_MS: Record<TextSpeed, number> = { slow: 45, normal: 25, fast: 8 };
export const TEXT_SPEEDS: TextSpeed[] = ["slow", "normal", "fast"];

const PROGRESS_KEY = "super-scholar.progress";
const SETTINGS_KEY = "super-scholar.settings";
const UPLOADS_KEY = "super-scholar.uploads";
const MAX_SAVED_UPLOADS = 3;
const DEFAULT_SETTINGS: Settings = { textSpeed: "normal", music: true, musicStyle: "upbeat", sfx: true };

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

export function clearProgress(storage: Storage | null = browserStorage()): void {
  try {
    storage?.removeItem(PROGRESS_KEY);
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

export function loadSettings(storage: Storage | null = browserStorage()): Settings {
  const value = (readJson(storage, SETTINGS_KEY) ?? {}) as Partial<Settings>;
  return {
    textSpeed: TEXT_SPEEDS.includes(value.textSpeed!) ? value.textSpeed! : DEFAULT_SETTINGS.textSpeed,
    music: typeof value.music === "boolean" ? value.music : DEFAULT_SETTINGS.music,
    musicStyle: MUSIC_STYLES.includes(value.musicStyle!) ? value.musicStyle! : DEFAULT_SETTINGS.musicStyle,
    sfx: typeof value.sfx === "boolean" ? value.sfx : DEFAULT_SETTINGS.sfx,
  };
}

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
