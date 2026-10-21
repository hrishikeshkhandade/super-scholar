// The facts the player found in the current level, in the order found and
// without repeats (a level can have more bears than its world has facts),
// for the card shown at LEVEL CLEAR.
export function addFoundFact(found: readonly number[], index: number): number[] {
  return found.includes(index) ? [...found] : [...found, index];
}
