import { describe, expect, it } from "vitest";
import worker from "../worker/index";

// A fake Cloudflare environment: game files, saved results, and limiters.
function fakeEnv(options: { allow?: boolean; saved?: unknown } = {}) {
  const puts: string[] = [];
  const feedbackPuts: string[] = [];
  const env = {
    ASSETS: { fetch: async () => new Response("<html>game</html>") },
    AI_WORLDS: {
      get: async () => options.saved ?? null,
      put: async (key: string) => void puts.push(key),
    },
    FEEDBACK: { put: async (key: string) => void feedbackPuts.push(key) },
    LEADERBOARD: { get: async () => null, put: async () => {}, list: async () => ({ keys: [], list_complete: true }) },
    DOWNLOAD_LIMITER: { limit: async () => ({ success: options.allow ?? true }) },
    FEEDBACK_LIMITER: { limit: async () => ({ success: options.allow ?? true }) },
    AI_LIMITER: { limit: async () => ({ success: options.allow ?? true }) },
    GEMINI_API_KEY: "test-key-not-real",
  };
  return { env, puts, feedbackPuts };
}

const aiRequest = (body: unknown) =>
  new Request("https://game.test/api/ai-game", { method: "POST", body: JSON.stringify(body) });

const validBody = {
  title: "How Plants Make Food",
  abstract: "",
  sections: [{ heading: "Light", excerpt: "Light splits water." }],
};

describe("Cloudflare worker", () => {
  it("serves the game's files for normal pages", async () => {
    const response = await worker.fetch(new Request("https://game.test/"), fakeEnv().env);
    expect(await response.text()).toBe("<html>game</html>");
  });

  it("answers unknown /api/ paths with 404 and security headers", async () => {
    const response = await worker.fetch(new Request("https://game.test/api/secret"), fakeEnv().env);
    expect(response.status).toBe(404);
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("turns away visitors over their limit", async () => {
    const { env } = fakeEnv({ allow: false });
    expect((await worker.fetch(aiRequest(validBody), env)).status).toBe(429);
    expect((await worker.fetch(new Request("https://game.test/api/fetch-paper?id=W1"), env)).status).toBe(429);
  });

  it("rejects bad AI requests before calling any AI", async () => {
    const { env } = fakeEnv();
    expect((await worker.fetch(new Request("https://game.test/api/ai-game"), env)).status).toBe(405);
    expect((await worker.fetch(aiRequest({ title: "" }), env)).status).toBe(400);
  });

  it("returns a saved result without calling the AI", async () => {
    const saved = { worlds: [{ name: "Saved world" }] };
    const { env, puts } = fakeEnv({ saved });
    const response = await worker.fetch(aiRequest(validBody), env);
    expect(await response.json()).toEqual({ worlds: saved.worlds, cached: true });
    expect(puts).toEqual([]);
  });

  it("saves valid feedback and refuses empty or broken forms", async () => {
    const { env, feedbackPuts } = fakeEnv();
    const send = (body: unknown) =>
      worker.fetch(new Request("https://game.test/api/feedback", { method: "POST", body: JSON.stringify(body) }), env);
    const good = await send({ ratings: { fun: 5, learned: 4 }, answers: { best: "The boss fight!" }, device: "keyboard" });
    expect(good.status).toBe(200);
    expect(feedbackPuts).toHaveLength(1);
    expect((await send({ ratings: {}, answers: {} })).status).toBe(400);
    expect((await send({ ratings: { fun: 9 } })).status).toBe(400);
    expect((await send({ answers: { best: "x".repeat(301) } })).status).toBe(400);
    expect(feedbackPuts).toHaveLength(1);
  });
});

