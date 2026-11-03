import { jumpHeight, jumpHeightAt, jumpReach } from "../jump";
import { TILE, parseLevel } from "./parseLevel";

// Checks that a level layout is beatable: it parses, the player and flag
// stand on ground, and the flag can be reached from the start by walking,
// dropping, and fair jumps. Used by the tests for hand-made levels and for
// every generated one.

export const GROUND_ROW = 12;

// A level may ask for at most this share of a perfect running jump's reach,
// so its jumps are fair for people, not just possible for a computer.
const FAIR_REACH = 0.8;
// And it may ask the player to climb at most this high in one jump.
const FAIR_RISE = jumpHeight() - 16;
const PLAYER_WIDTH = 20; // px, the player's body
const SOLID = "#B?HS";
const MOVING_PLATFORM_TILES = 6; // a 3-tile platform that slides 3 tiles over

interface Spot {
  x: number;
  y: number; // the row the player stands on top of
}

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
  if (problems.length > 0) return problems;

  const reached = reachableSpots(rows, { x: level.start.x, y: level.start.y + 1 });
  if (!reached.has(key({ x: level.goal.x, y: level.goal.y + 1 }))) {
    const farthest = Math.max(...[...reached].map((spot) => Number(spot.split(",")[0])));
    problems.push(`the flag can't be reached from the start (stuck after column ${farthest})`);
  }
  return problems;
}

const key = (spot: Spot) => `${spot.x},${spot.y}`;

// Everywhere the player can stand: on top of ground, blocks, and platforms,
// with room above (and not on candle spikes). Moving platforms count over
// the whole stretch they slide along.
function standingSpots(rows: string[]): Spot[] {
  const at = (x: number, y: number) => rows[y]?.[x] ?? " ";
  const surfaces = new Set<string>();
  rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      if (SOLID.includes(char) || char === "-") surfaces.add(key({ x, y }));
      if (char === "~") for (let i = 0; i < MOVING_PLATFORM_TILES; i++) surfaces.add(key({ x: x + i, y }));
    }),
  );
  return [...surfaces]
    .map((spot) => ({ x: Number(spot.split(",")[0]), y: Number(spot.split(",")[1]) }))
    .filter((spot) => spot.y > 0 && !SOLID.includes(at(spot.x, spot.y - 1)) && at(spot.x, spot.y - 1) !== "^");
}

// Whether a running jump (or walking, or dropping) gets from one spot to
// another, clearing anything solid in between. It ignores bumping into
// blocks overhead, which the chunks avoid.
function canMove(rows: string[], from: Spot, to: Spot): boolean {
  const across = Math.abs(to.x - from.x);
  if (across === 0) return false;
  const rise = (from.y - to.y) * TILE;
  if (rise > FAIR_RISE) return false;
  const gap = Math.max(0, (across - 1) * TILE - PLAYER_WIDTH);
  const reach = jumpReach(rise);
  if (reach === undefined || gap > FAIR_REACH * reach) return false;
  return clearsObstacles(rows, from, to);
}

// Solid tiles in the player's way between the two spots (at body height,
// not floating overhead) must be low enough for the jump's arc to pass over.
function clearsObstacles(rows: string[], from: Spot, to: Spot): boolean {
  const solid = (x: number, y: number) => SOLID.includes(rows[y]?.[x] ?? " ");
  const step = Math.sign(to.x - from.x);
  const lowest = Math.max(from.y, to.y);
  for (let x = from.x + step; x !== to.x; x += step) {
    // The highest solid tile in this column that reaches down into the path.
    let top = -1;
    for (let y = lowest - 1; y >= Math.min(from.y, to.y) - 2 && y >= 0; y--) if (solid(x, y)) top = y;
    if (top < 0) continue;
    while (top > 0 && solid(x, top - 1)) top--;
    const height = (from.y - top) * TILE;
    // The jump is lowest at one of the column's edges (the near one going up,
    // the far one coming down), so it must clear both.
    const nearEdge = Math.max(0, (Math.abs(x - from.x) - 1) * TILE);
    const arcs = [jumpHeightAt(nearEdge), jumpHeightAt(nearEdge + TILE + PLAYER_WIDTH)];
    if (arcs.some((arc) => arc === undefined || arc < height + 4) || height > FAIR_RISE) return false;
  }
  return true;
}

function reachableSpots(rows: string[], start: Spot): Set<string> {
  const spots = standingSpots(rows);
  const reached = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const from = queue.shift()!;
    for (const to of spots) {
      if (Math.abs(to.x - from.x) > 8 || reached.has(key(to)) || !canMove(rows, from, to)) continue;
      reached.add(key(to));
      queue.push(to);
    }
  }
  return reached;
}
