// NORMAL keeps the game gentle, so learning comes first. HARD is optional
// (a classmate asked for a challenge): fewer hearts and faster enemies, but
// the same questions and lessons, so it only tests the platforming.

export type Difficulty = "normal" | "hard";
export const DIFFICULTIES: Difficulty[] = ["normal", "hard"];

export interface Tuning {
  hudLabel: string | null; // shown next to the hearts so the player knows it's on
  startLives: number;
  bearSpeed: number; // multiplier on the bears' walking speed
  bossSpeed: number; // multiplier on the boss's walking and charging speed
  bossAttackEvery: number; // multiplier on the time between boss attacks
}

export const TUNING: Record<Difficulty, Tuning> = {
  normal: { hudLabel: null, startLives: 3, bearSpeed: 1, bossSpeed: 1, bossAttackEvery: 1 },
  hard: { hudLabel: "HARD", startLives: 2, bearSpeed: 1.5, bossSpeed: 1.25, bossAttackEvery: 0.75 },
};
