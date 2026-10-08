import { parseLevel } from "./parseLevel";

// Checks that a level layout is beatable: it parses, the player and flag
// stand on ground, and every pit can be jumped or is crossed by a platform.
// Used by the tests for hand-made levels and for generated ones.

export const GROUND_ROW = 12;
export const MAX_JUMPABLE_GAP = 4; // tiles; a running jump covers about 5

export function layoutProblems(rows: string[]): string[] {
  let level;
  try {
    level = parseLevel(rows);
  } catch (error) {
    return [(error as Error).message];
  }
  const problems: string[] = [];
  const solidBelow = (x: number, y: number) => rows[y + 1]?.[x] === "#";
  if (!solidBelow(level.start.x, level.start.y)) problems.push("player start isn't on ground");
  if (!solidBelow(level.goal.x, level.goal.y)) problems.push("flag isn't on ground");

  const ground = rows[GROUND_ROW] ?? "";
  for (const match of ground.matchAll(/ +/g)) {
    const start = match.index!;
    const end = start + match[0].length;
    const bridged = rows.some((row) => /[~-]/.test(row.slice(start, end)));
    if (!bridged && match[0].length > MAX_JUMPABLE_GAP) problems.push(`pit at column ${start} is too wide to jump`);
  }
  return problems;
}
