import { seededRandom } from "../generator/questions";
import type { LevelLayout } from "./layouts";

// Builds new levels by stitching together small hand-designed chunks, the
// way games like Spelunky make endless levels: each chunk is beatable on its
// own, so the whole level is too. The same seed always gives the same level.

interface Chunk {
  difficulty: number; // 0 (easy) to 1 (hard)
  // Rows 5 to 11 (above the ground), then the ground row. Every string in a
  // chunk has the same width. "X" becomes a random block (mostly coins).
  art: [string, string, string, string, string, string, string];
  ground: string;
}

const blank = (width: number) => " ".repeat(width);

const CHUNKS: Chunk[] = [
  // Coins along the ground
  { difficulty: 0, art: [blank(9), blank(9), blank(9), blank(9), blank(9), blank(9), " o o o   "], ground: "#########" },
  // A row of blocks to hit from below
  { difficulty: 0.1, art: [blank(9), blank(9), blank(9), "  ?BXB   ", blank(9), blank(9), blank(9)], ground: "#########" },
  // A small pit with a coin arc over it
  { difficulty: 0.2, art: [blank(9), blank(9), blank(9), blank(9), "   oo    ", blank(9), blank(9)], ground: "###  ####" },
  // One candle spike
  { difficulty: 0.25, art: [blank(9), blank(9), blank(9), blank(9), blank(9), blank(9), "    ^    "], ground: "#########" },
  // One bear on flat ground (easy, so even the first level has bears)
  { difficulty: 0.1, art: [blank(9), blank(9), blank(9), blank(9), blank(9), blank(9), "     b   "], ground: "#########" },
  // A wall to hop
  { difficulty: 0.3, art: [blank(9), blank(9), blank(9), blank(9), blank(9), "    ##   ", "    ##   "], ground: "#########" },
  // Blocks over a bear
  { difficulty: 0.4, art: [blank(10), blank(10), blank(10), "   BXB    ", blank(10), blank(10), "    b     "], ground: "##########" },
  // Stairs up and a drop
  { difficulty: 0.4, art: [blank(9), blank(9), blank(9), blank(9), "     #   ", "    ##   ", "   ###   "], ground: "#########" },
  // Platforms up to a coin stash
  {
    difficulty: 0.45,
    art: ["       ooo  ", "       ---  ", blank(12), blank(12), "  ---       ", blank(12), blank(12)],
    ground: "############",
  },
  // A wide pit
  { difficulty: 0.5, art: [blank(10), blank(10), blank(10), "   oooo   ", blank(10), blank(10), blank(10)], ground: "###    ###" },
  // Two spikes
  { difficulty: 0.5, art: [blank(9), blank(9), blank(9), blank(9), blank(9), blank(9), "   ^^    "], ground: "#########" },
  // A moving platform over a long pit
  {
    difficulty: 0.6,
    art: [blank(12), blank(12), "   ooo      ", blank(12), "  ~         ", blank(12), blank(12)],
    ground: "##      ####",
  },
  // Two bears
  { difficulty: 0.6, art: [blank(11), blank(11), blank(11), blank(11), blank(11), blank(11), "  b    b   "], ground: "###########" },
  // Stepping-stone platforms across a pit
  {
    difficulty: 0.75,
    art: [blank(12), blank(12), blank(12), "      oo    ", "  --  --    ", blank(12), blank(12)],
    ground: "##        ##",
  },
  // A brick ceiling with coins underneath
  { difficulty: 0.2, art: [blank(10), blank(10), blank(10), "  BBBBBB  ", blank(10), "   oooo   ", blank(10)], ground: "##########" },
  // A market bubble bobbing over the path
  { difficulty: 0.35, art: [blank(9), blank(9), blank(9), blank(9), "    u    ", blank(9), " o     o "], ground: "#########" },
  // Hop across pits onto a pillar
  {
    difficulty: 0.45,
    art: [blank(12), blank(12), blank(12), "     oo     ", blank(12), "     ##     ", "     ##     "],
    ground: "###  ##  ###",
  },
  // A bear patrolling a brick bridge, coins below
  {
    difficulty: 0.55,
    art: [blank(10), blank(10), "    b     ", "  BBBBBB  ", blank(10), blank(10), "   ooo    "],
    ground: "##########",
  },
  // A bed of spikes with a platform over it
  {
    difficulty: 0.65,
    art: [blank(11), blank(11), blank(11), "   ooo     ", "  -----    ", blank(11), "  ^^^^^    "],
    ground: "###########",
  },
  // A bubble guarding a pit
  {
    difficulty: 0.7,
    art: [blank(10), blank(10), blank(10), "    u     ", blank(10), blank(10), blank(10)],
    ground: "###   ####",
  },
  // Spike, wall, and bear in a row
  {
    difficulty: 0.85,
    art: [blank(12), blank(12), blank(12), blank(12), blank(12), "     ##     ", "  ^  ##  b  "],
    ground: "############",
  },
];

const NAMES = [
  "Citation Cliffs",
  "Hypothesis Hills",
  "Footnote Forest",
  "Peer Review Peaks",
  "Data Desert",
  "Margin Marsh",
  "Abstract Alps",
  "Variable Valley",
  "Sample Size Summit",
  "Theory Tundra",
];

const HEIGHT = 14;
// Every third chunk has a bear, since stomping bears is how players find fun facts.
const BEAR_EVERY = 3;

const hasBear = (chunk: Chunk) => chunk.art.some((line) => line.includes("b"));

export function generateLayout(seed: number, difficulty: number): LevelLayout {
  const random = seededRandom(seed);
  const rows: string[][] = Array.from({ length: HEIGHT }, () => []);
  const append = (art: string[], ground: string) => {
    const width = ground.length;
    for (let y = 0; y < 5; y++) rows[y].push(...blank(width));
    art.forEach((line, i) => rows[5 + i].push(...line));
    rows[12].push(...ground);
    rows[13].push(...ground);
  };

  // A safe start and a safe finish, with the chosen chunks in between.
  append([blank(6), blank(6), blank(6), blank(6), blank(6), blank(6), "  P   "], "######");
  const usable = CHUNKS.filter((chunk) => chunk.difficulty <= difficulty + 0.15);
  const withBears = usable.filter(hasBear);
  const count = 8 + Math.round(difficulty * 5);
  for (let i = 0; i < count; i++) {
    const choices = i % BEAR_EVERY === 1 ? withBears : usable;
    // Harder settings favour harder chunks, but easy ones still appear as breathers.
    const weights = choices.map((chunk) => 1 + chunk.difficulty * difficulty * 4);
    let pick = random() * weights.reduce((sum, w) => sum + w, 0);
    const chunk = choices.find((_, index) => (pick -= weights[index]) <= 0) ?? choices[0];
    const art = chunk.art.map((line) =>
      line.replace(/X/g, () => {
        const roll = random();
        return roll < 0.12 ? "H" : roll < 0.22 ? "S" : "?";
      }),
    );
    append(art, chunk.ground);
  }
  append([blank(8), blank(8), blank(8), blank(8), blank(8), blank(8), " o o  F "], "########");

  return { name: NAMES[Math.floor(random() * NAMES.length)], rows: rows.map((row) => row.join("")) };
}
