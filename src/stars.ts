// Star ratings, 1 to 3. Clearing always earns one; the other two reward
// playing well, so there's a reason to replay a level.

export const COIN_GOAL = 0.75; // share of a level's coins needed for a star

export interface LevelResult {
  coinsCollected: number;
  coinsInLevel: number;
  hits: number; // times hurt, including falling into a pit
}

export interface BossResult {
  wrongAnswers: number;
  hits: number;
}

export function levelStars({ coinsCollected, coinsInLevel, hits }: LevelResult): number {
  const enoughCoins = coinsCollected >= Math.ceil(coinsInLevel * COIN_GOAL);
  return 1 + (enoughCoins ? 1 : 0) + (hits === 0 ? 1 : 0);
}

export function bossStars({ wrongAnswers, hits }: BossResult): number {
  return 1 + (wrongAnswers === 0 ? 1 : 0) + (hits === 0 ? 1 : 0);
}
