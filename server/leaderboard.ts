import { BOARD_SIZE, compareEntries, isPaperId, parseSubmission, type BoardEntry } from "../src/leaderboard";
import { jsonError } from "./aiProviders";

// Each paper's top 10. Every nickname's best run is its own stored entry
// (Cloudflare KV on the live site), and the board is built from them when
// read. One shared list per paper lost scores: KV can serve a copy up to a
// minute old, so two runs submitted close together overwrote each other.

const MAX_BODY_CHARS = 1_000;

export interface BoardStore {
  get(key: string): Promise<BoardEntry | null>;
  put(key: string, entry: BoardEntry): Promise<void>;
  // Every entry whose key starts with prefix.
  list(prefix: string): Promise<BoardEntry[]>;
}

const paperPrefix = (paperId: string) => `entry:${paperId}:`;
const entryKey = (paperId: string, name: string) => `${paperPrefix(paperId)}${name.toLowerCase()}`;
const noStore = { "cache-control": "no-store" };

const topOf = (entries: BoardEntry[]) => [...entries].sort(compareEntries).slice(0, BOARD_SIZE);

export async function handleLeaderboard(request: Request, store: BoardStore): Promise<Response> {
  if (request.method === "GET") {
    const paperId = new URL(request.url).searchParams.get("paper");
    if (!isPaperId(paperId)) return jsonError(400, "Not a valid paper.");
    return Response.json({ entries: topOf(await store.list(paperPrefix(paperId))) }, { headers: noStore });
  }
  if (request.method !== "POST") return jsonError(405, "Only GET and POST requests are allowed.");

  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return jsonError(413, "Too long.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Not valid JSON.");
  }
  const submission = parseSubmission(body);
  if (!submission) return jsonError(400, "That score or nickname isn't allowed.");

  const { paperId, ...score } = submission;
  const key = entryKey(paperId, score.name);
  const entry: BoardEntry = { ...score, at: Date.now() };
  // A nickname keeps its best run.
  const previous = await store.get(key);
  const best = previous && compareEntries(previous, entry) <= 0 ? previous : entry;
  if (best === entry) await store.put(key, entry);

  // A just-written entry can take a moment to show up in the list, so it's
  // merged in by hand.
  const others = (await store.list(paperPrefix(paperId))).filter((other) => other.name.toLowerCase() !== best.name.toLowerCase());
  const board = topOf([...others, best]);
  return Response.json({ entries: board, place: board.indexOf(best) + 1 }, { headers: noStore });
}
