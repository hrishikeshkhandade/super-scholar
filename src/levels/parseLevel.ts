// Turns a text layout (see layouts.ts) into lists of things to place.
// Kept free of Phaser so it can be unit tested.

export const TILE = 32;

export type BlockContents = "coin" | "heart" | "shield";

export interface TilePos {
  x: number;
  y: number;
}

export interface ParsedLevel {
  widthTiles: number;
  heightTiles: number;
  ground: (TilePos & { top: boolean })[];
  bricks: TilePos[];
  blocks: (TilePos & { contents: BlockContents })[];
  platforms: TilePos[];
  movingPlatforms: TilePos[];
  spikes: TilePos[];
  bears: TilePos[];
  bubbles: TilePos[];
  coins: TilePos[];
  start: TilePos;
  goal: TilePos;
}

const BLOCK_CONTENTS: Record<string, BlockContents> = { "?": "coin", H: "heart", S: "shield" };

export function parseLevel(rows: string[]): ParsedLevel {
  const widthTiles = Math.max(...rows.map((row) => row.length));
  const at = (x: number, y: number) => rows[y]?.[x] ?? " ";
  const level: Omit<ParsedLevel, "start" | "goal"> & { start?: TilePos; goal?: TilePos } = {
    widthTiles,
    heightTiles: rows.length,
    ground: [],
    bricks: [],
    blocks: [],
    platforms: [],
    movingPlatforms: [],
    spikes: [],
    bears: [],
    bubbles: [],
    coins: [],
  };

  rows.forEach((row, y) => {
    [...row].forEach((char, x) => {
      const pos = { x, y };
      switch (char) {
        case "#":
          level.ground.push({ ...pos, top: at(x, y - 1) !== "#" });
          break;
        case "B":
          level.bricks.push(pos);
          break;
        case "?":
        case "H":
        case "S":
          level.blocks.push({ ...pos, contents: BLOCK_CONTENTS[char] });
          break;
        case "-":
          level.platforms.push(pos);
          break;
        case "~":
          level.movingPlatforms.push(pos);
          break;
        case "^":
          level.spikes.push(pos);
          break;
        case "b":
          level.bears.push(pos);
          break;
        case "u":
          level.bubbles.push(pos);
          break;
        case "o":
          level.coins.push(pos);
          break;
        case "P":
          level.start = pos;
          break;
        case "F":
          level.goal = pos;
          break;
        case " ":
          break;
        default:
          throw new Error(`Unknown level tile "${char}" at column ${x}, row ${y}`);
      }
    });
  });

  if (!level.start) throw new Error("Level has no player start (P)");
  if (!level.goal) throw new Error("Level has no goal flag (F)");
  return level as ParsedLevel;
}

// Solid tiles that block movement, for things like a bear checking for a ledge.
export function isSolidTile(rows: string[], x: number, y: number): boolean {
  const char = rows[y]?.[x];
  return char !== undefined && "#B?HS".includes(char);
}
