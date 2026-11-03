import { seededRandom } from "../generator/questions";
import type { LevelLayout } from "./layouts";

// Builds new levels by stitching together small hand-designed chunks, the
// way games like Spelunky make endless levels: each chunk is beatable on its
// own, so the whole level is too. The same seed always gives the same level.

// The kinds of challenge that make a level more than single hops. Every
// generated level has at least two (see generateLayout's required).
export type ChallengeKind = "chain" | "gap" | "timing" | "climb";
export const CHALLENGE_KINDS: ChallengeKind[] = ["chain", "gap", "timing", "climb"];

interface Chunk {
  difficulty: number; // 0 (easy) to 1 (hard)
  kind?: ChallengeKind;
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
    kind: "climb",
    art: ["       ooo  ", "       ---  ", blank(12), blank(12), "  ---       ", blank(12), blank(12)],
    ground: "############",
  },
  // A wide pit
  { difficulty: 0.5, kind: "gap", art: [blank(10), blank(10), blank(10), "   oooo   ", blank(10), blank(10), blank(10)], ground: "###    ###" },
  // Two spikes
  { difficulty: 0.5, art: [blank(9), blank(9), blank(9), blank(9), blank(9), blank(9), "   ^^    "], ground: "#########" },
  // A moving platform over a long pit
  {
    difficulty: 0.6,
    kind: "timing",
    art: [blank(12), blank(12), "   ooo      ", blank(12), "  ~         ", blank(12), blank(12)],
    ground: "##      ####",
  },
  // Two bears
  { difficulty: 0.6, art: [blank(11), blank(11), blank(11), blank(11), blank(11), blank(11), "  b    b   "], ground: "###########" },
  // Stepping-stone platforms across a pit
  {
    difficulty: 0.75,
    kind: "chain",
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
  // Stepping stones at changing heights over a long pit
  {
    difficulty: 0.35,
    kind: "chain",
    art: [blank(14), blank(14), "      oo      ", "      --      ", "         --   ", "   --         ", blank(14)],
    ground: "##          ##",
  },
  // Brick hops over a bed of candles
  {
    difficulty: 0.6,
    kind: "chain",
    art: [blank(14), blank(14), blank(14), "   oo   oo    ", "   BB   BB    ", blank(14), "  ^^^^^^^^^^  "],
    ground: "##############",
  },
  // A pit wide enough to need a running jump
  { difficulty: 0.45, kind: "gap", art: [blank(12), blank(12), "    ooo     ", blank(12), blank(12), blank(12), blank(12)], ground: "###     ####" },
  // A pit with a higher ledge on the far side
  {
    difficulty: 0.7,
    kind: "gap",
    art: [blank(12), blank(12), blank(12), "         o  ", blank(12), "       #####", "       #####"],
    ground: "###    #####",
  },
  // Two pits with a small island between them
  {
    difficulty: 0.85,
    kind: "gap",
    art: [blank(15), blank(15), "   oo     ooo  ", blank(15), blank(15), blank(15), blank(15)],
    ground: "##    ##     ##",
  },
  // A bear patrolling the island you have to land on
  {
    difficulty: 0.5,
    kind: "timing",
    art: [blank(14), blank(14), blank(14), "      oo      ", blank(14), blank(14), "       b      "],
    ground: "##   ####   ##",
  },
  // A moving platform to ride over a bed of candles
  {
    difficulty: 0.65,
    kind: "timing",
    art: [blank(13), blank(13), "    ooo      ", blank(13), blank(13), "  ~          ", "  ^^^^^^^^^  "],
    ground: "#############",
  },
  // A bear on a brick bridge over a pit
  {
    difficulty: 0.8,
    kind: "timing",
    art: [blank(12), blank(12), blank(12), blank(12), "      b     ", "  BBBBBBBB  ", blank(12)],
    ground: "##        ##",
  },
  // Ledges up and over a wall too tall to jump
  {
    difficulty: 0.4,
    kind: "climb",
    art: [blank(14), "          oo  ", "          ##  ", "      --  ##  ", "          ##  ", "   --     ##  ", "          ##  "],
    ground: "##############",
  },
  // A brick staircase over a bed of candles
  {
    difficulty: 0.75,
    kind: "climb",
    art: [blank(14), "         oo   ", blank(14), "      BB      ", "         BB   ", "   BB         ", "   ^^^^^^^^   "],
    ground: "##############",
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

// required: challenge kinds the level must include at least once.
export function generateLayout(seed: number, difficulty: number, required: ChallengeKind[] = []): GeneratedLayout {
  const random = seededRandom(seed);
  // Chunks far easier than the level (other than bear ones) are left out, so
  // later levels aren't padded with single hops.
  const usable = CHUNKS.filter(
    (chunk) => chunk.difficulty <= difficulty + 0.15 && (chunk.difficulty >= difficulty - 0.5 || hasBear(chunk)),
  );
  const withBears = usable.filter(hasBear);
  const count = 8 + Math.round(difficulty * 5);
  // Harder settings favour harder chunks, but easier ones still appear as breathers.
  const pickFrom = (choices: Chunk[]) => {
    const weights = choices.map((chunk) => 1 + chunk.difficulty * difficulty * 8);
    let pick = random() * weights.reduce((sum, w) => sum + w, 0);
    return choices.find((_, index) => (pick -= weights[index]) <= 0) ?? choices[0];
  };
  const picks = Array.from({ length: count }, (_, i) => pickFrom(i % BEAR_EVERY === 1 ? withBears : usable));
  // Each missing required kind replaces one pick, never a bear slot or a
  // chunk of another required kind, using the easiest chunk of that kind if
  // none is in range yet.
  for (const kind of required) {
    if (picks.some((chunk) => chunk.kind === kind)) continue;
    const ofKind = usable.filter((chunk) => chunk.kind === kind);
    const easiest = CHUNKS.filter((chunk) => chunk.kind === kind).sort((a, b) => a.difficulty - b.difficulty)[0];
    const isRequired = (chunk: Chunk) => chunk.kind !== undefined && required.includes(chunk.kind);
    const slots = picks.map((_, i) => i).filter((i) => i % BEAR_EVERY !== 1 && !isRequired(picks[i]));
    picks[slots[Math.floor(random() * slots.length)]] = ofKind.length > 0 ? pickFrom(ofKind) : easiest;
  }

  return {
    name: NAMES[Math.floor(random() * NAMES.length)],
    rows: stitch(picks, random),
    challenges: CHALLENGE_KINDS.filter((kind) => picks.some((chunk) => chunk.kind === kind)),
  };
}

// A generated level also says which kinds of challenge it has (for the tests).
export interface GeneratedLayout extends LevelLayout {
  challenges: ChallengeKind[];
}

// Joins chunks into level rows, between a safe start and a safe finish.
function stitch(chunks: Chunk[], random: () => number): string[] {
  const rows: string[][] = Array.from({ length: HEIGHT }, () => []);
  const append = (art: string[], ground: string) => {
    const width = ground.length;
    for (let y = 0; y < 5; y++) rows[y].push(...blank(width));
    art.forEach((line, i) => rows[5 + i].push(...line));
    rows[12].push(...ground);
    rows[13].push(...ground);
  };
  append([blank(6), blank(6), blank(6), blank(6), blank(6), blank(6), "  P   "], "######");
  for (const chunk of chunks) {
    const art = chunk.art.map((line) =>
      line.replace(/X/g, () => {
        const roll = random();
        return roll < 0.12 ? "H" : roll < 0.22 ? "S" : "?";
      }),
    );
    append(art, chunk.ground);
  }
  append([blank(8), blank(8), blank(8), blank(8), blank(8), blank(8), " o o  F "], "########");
  return rows.map((row) => row.join(""));
}

// Each chunk alone between the safe start and finish, so tests can check
// every one is beatable on its own.
export const chunkLevels = (): string[][] => CHUNKS.map((chunk) => stitch([chunk], () => 0.5));
