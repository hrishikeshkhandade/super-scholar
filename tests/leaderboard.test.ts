import { describe, expect, it } from "vitest";
import { handleLeaderboard } from "../server/leaderboard";
import { LIBRARY } from "../src/content/library";
import { BOARD_SIZE, compareEntries, formatTime, nicknameProblem, parseSubmission, type BoardEntry } from "../src/leaderboard";
import { bossQuestionKey, endRun, finishRun, finishedRun, loadRun, practiceKey, recordAnswer, recordStars, runResult, startRun } from "../src/run";
import { stageKey } from "../src/save";

const entry = (name: string, score: number, timeMs: number | null, at = 0): BoardEntry => ({ name, score, total: 30, timeMs, at });

function memoryStorage() {
  const items = new Map<string, string>();
  return {
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
    removeItem: (key: string) => void items.delete(key),
  };
}

function memoryStore() {
  const items = new Map<string, BoardEntry>();
  return {
    get: async (key: string) => items.get(key) ?? null,
    put: async (key: string, entry: BoardEntry) => void items.set(key, entry),
    list: async (prefix: string) => [...items].filter(([key]) => key.startsWith(prefix)).map(([, entry]) => entry),
  };
}

const post = (name: string, score: number) =>
  new Request("https://game.test/api/leaderboard", {
    method: "POST",
    body: JSON.stringify({ paperId: "bitcoin-2008", name, score, total: 20, timeMs: null }),
  });

describe("leaderboard ranking", () => {
  it("ranks by knowledge first, then a counted time, then speed", () => {
    const board = [entry("Slow", 20, 900_000), entry("NoTime", 20, null), entry("Fast", 20, 600_000), entry("Smart", 25, null)].sort(compareEntries);
    expect(board.map((e) => e.name)).toEqual(["Smart", "Fast", "Slow", "NoTime"]);
  });

  it("checks nicknames and scores", () => {
    expect(nicknameProblem("Cassie")).toBeUndefined();
    expect(nicknameProblem("ab")).toBeDefined();
    expect(nicknameProblem("<script>")).toBeDefined();
    expect(nicknameProblem("shithead")).toBeDefined();
    const ok = { paperId: "bitcoin-2008", name: "Hrishi", score: 10, total: 20, timeMs: null };
    expect(parseSubmission(ok)).toEqual(ok);
    expect(parseSubmission({ ...ok, score: 21 })).toBeUndefined();
    expect(parseSubmission({ ...ok, timeMs: 5 })).toBeUndefined();
    expect(parseSubmission({ ...ok, paperId: "../secret" })).toBeUndefined();
  });

  it("shows times as minutes and seconds", () => {
    expect(formatTime(754_000)).toBe("12:34");
    expect(formatTime(3_725_000)).toBe("1:02:05");
    expect(formatTime(null)).toBe("-");
  });
});

describe("leaderboard server", () => {
  it("adds a score and reads the board back", async () => {
    const store = memoryStore();
    const post = new Request("https://game.test/api/leaderboard", {
      method: "POST",
      body: JSON.stringify({ paperId: "bitcoin-2008", name: "Adhi", score: 12, total: 20, timeMs: null }),
    });
    expect(await (await handleLeaderboard(post, store)).json()).toMatchObject({ place: 1 });
    const get = await handleLeaderboard(new Request("https://game.test/api/leaderboard?paper=bitcoin-2008"), store);
    expect((await get.json()) as unknown).toMatchObject({ entries: [{ name: "Adhi", score: 12 }] });
  });

  // Found while testing: one shared list per paper lost scores sent close
  // together, because the storage can return a slightly old copy.
  it("never loses a score when several arrive at once", async () => {
    const store = memoryStore();
    await Promise.all(["Ana", "Ben", "Cy", "Dee", "Eve"].map((name, i) => handleLeaderboard(post(`${name}xx`, 10 + i), store)));
    const get = await handleLeaderboard(new Request("https://game.test/api/leaderboard?paper=bitcoin-2008"), store);
    const { entries } = (await get.json()) as { entries: BoardEntry[] };
    expect(entries.map((e) => e.name)).toEqual(["Evexx", "Deexx", "Cyxx", "Benxx", "Anaxx"]);
  });

  it("keeps a nickname's best run", async () => {
    const store = memoryStore();
    await handleLeaderboard(post("Adhi", 15), store);
    const worse = (await (await handleLeaderboard(post("ADHI", 9), store)).json()) as { entries: BoardEntry[] };
    expect(worse.entries).toEqual([expect.objectContaining({ name: "Adhi", score: 15 })]);
  });

  it("shows only the top 10, and says when a score didn't make it", async () => {
    const store = memoryStore();
    for (let i = 0; i < BOARD_SIZE; i++) await handleLeaderboard(post(`Player${i}`, 10 + i), store);
    const late = (await (await handleLeaderboard(post("Late", 1), store)).json()) as { entries: BoardEntry[]; place: number };
    expect(late.entries).toHaveLength(BOARD_SIZE);
    expect(late.place).toBe(0);
  });

  it("refuses bad nicknames", async () => {
    const post = new Request("https://game.test/api/leaderboard", {
      method: "POST",
      body: JSON.stringify({ paperId: "bitcoin-2008", name: "x", score: 1, total: 20, timeMs: null }),
    });
    expect((await handleLeaderboard(post, memoryStore())).status).toBe(400);
  });
});

describe("leaderboard runs", () => {
  const paper = LIBRARY[0];
  const allStages = paper.worlds.flatMap((world, w) => [...world.cutscenes.map((_, c) => c), "boss" as const].map((stage) => [w, stage] as const));

  it("counts only the first answer to each question", () => {
    const storage = memoryStorage();
    startRun(paper.id, storage);
    recordAnswer(paper.id, practiceKey(0, 0), true, storage);
    recordAnswer(paper.id, bossQuestionKey(0, 0), false, storage);
    recordAnswer(paper.id, bossQuestionKey(0, 0), true, storage); // a retry doesn't help
    expect(runResult(paper, loadRun(paper.id, storage)!).score).toBe(1);
  });

  it("only gives a time when every level and boss got 3 stars", () => {
    const storage = memoryStorage();
    startRun(paper.id, storage);
    for (const [w, stage] of allStages) recordStars(paper.id, w, stage, 3, storage);
    expect(runResult(paper, { ...loadRun(paper.id, storage)!, playMs: 600_000 }).timeMs).toBe(600_000);
    recordStars(paper.id, 0, 1, 2, storage);
    expect(runResult(paper, loadRun(paper.id, storage)!).timeMs).toBeNull();
    expect(Object.keys(loadRun(paper.id, storage)!.stars)).toContain(stageKey(0, "boss"));
  });

  it("keeps a finished run until it's submitted, and ignores other papers", () => {
    const storage = memoryStorage();
    startRun(paper.id, storage);
    expect(finishedRun(paper.id, storage)).toBeUndefined();
    finishRun(paper.id, storage);
    expect(finishedRun(paper.id, storage)).toBeDefined();
    expect(finishedRun("someone-else", storage)).toBeUndefined();
    endRun(storage);
    expect(finishedRun(paper.id, storage)).toBeUndefined();
  });
});
