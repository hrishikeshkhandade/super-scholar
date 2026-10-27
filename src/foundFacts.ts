// Which fun facts a level's bears give. Each level gets its own share of the
// world's facts (8 facts over 3 levels split 2, 3, 3), so the same fact never
// shows up in two levels of one world.
export function levelFacts(factCount: number, levelCount: number, levelIndex: number): number[] {
  const start = Math.floor((levelIndex * factCount) / levelCount);
  const end = Math.floor(((levelIndex + 1) * factCount) / levelCount);
  return Array.from({ length: end - start }, (_, i) => start + i);
}

// The fact the next stomped bear gives: this level's first one not found yet
// (found is in the order found, kept for the LEVEL CLEAR card), or undefined
// once the level has no new facts left.
export function nextFact(found: readonly number[], factCount: number, levelCount: number, levelIndex: number): number | undefined {
  return levelFacts(factCount, levelCount, levelIndex).find((index) => !found.includes(index));
}
