import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAskScholar } from "../server/askScholar";
import { MAX_ANSWER_CHARS, MAX_QUESTION_CHARS, parseScholarAnswer, parseScholarQuestion } from "../src/scholar";
import worker from "../worker/index";

const question = {
  paperTitle: "Statistical Arbitrage",
  lessonTitle: "Mean Reversion",
  lesson: "Prices that drift apart tend to come back together.",
  question: "What does mean reversion mean?",
};

const ask = (body: unknown) => new Request("https://game.test/api/ask-scholar", { method: "POST", body: JSON.stringify(body) });

// A fake Gemini that answers each call with the next queued reply.
function fakeGemini(replies: (object | "fail")[]) {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    const reply = replies[Math.min(calls++, replies.length - 1)];
    if (reply === "fail") return new Response("busy", { status: 503 });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
  });
  return () => calls;
}

afterEach(() => vi.unstubAllGlobals());

describe("Ask the Scholar rules", () => {
  it("accepts a short question about a lesson", () => {
    expect(parseScholarQuestion(question)).toEqual(question);
  });

  it("rejects empty or overlong questions", () => {
    expect(parseScholarQuestion({ ...question, question: "   " })).toBeUndefined();
    expect(parseScholarQuestion({ ...question, question: "x".repeat(MAX_QUESTION_CHARS + 1) })).toBeUndefined();
    expect(parseScholarQuestion({ ...question, lesson: 42 })).toBeUndefined();
  });

  it("strips markdown from answers and keeps whole sentences that fit the speech box", () => {
    expect(parseScholarAnswer({ answer: "It **comes back** to normal." })).toBe("It comes back to normal.");
    const long = `${"This sentence is here to fill space. ".repeat(20)}`;
    const trimmed = parseScholarAnswer({ answer: long })!;
    expect(trimmed.length).toBeLessThanOrEqual(MAX_ANSWER_CHARS);
    expect(trimmed.endsWith(".")).toBe(true);
    expect(parseScholarAnswer({ answer: "" })).toBeUndefined();
    expect(parseScholarAnswer({ reply: "wrong shape" })).toBeUndefined();
  });
});

describe("Ask the Scholar server", () => {
  it("answers from the next AI when the first one is busy", async () => {
    const calls = fakeGemini(["fail", { answer: "It means prices drift back to normal." }]);
    const response = await handleAskScholar(ask(question), { geminiKey: "test-key-not-real" });
    expect(await response.json()).toEqual({ answer: "It means prices drift back to normal." });
    expect(calls()).toBe(2);
  });

  it("tries the fast Groq model first, then Gemini", async () => {
    const asked: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      asked.push(url.includes("groq") ? "groq" : "gemini");
      return new Response("busy", { status: 503 });
    });
    await handleAskScholar(ask(question), { geminiKey: "test-key-not-real", groqKey: "test-key-not-real" });
    expect(asked).toEqual(["groq", "gemini", "gemini"]);
  });

  it("says so when no AI can answer", async () => {
    fakeGemini(["fail"]);
    const response = await handleAskScholar(ask(question), { geminiKey: "test-key-not-real" });
    expect(response.status).toBe(503);
  });

  it("refuses bad questions without calling any AI", async () => {
    const calls = fakeGemini([{ answer: "unused" }]);
    const response = await handleAskScholar(ask({ ...question, question: "" }), { geminiKey: "test-key-not-real" });
    expect(response.status).toBe(400);
    expect(calls()).toBe(0);
  });

  it("has its own rate limit in the worker", async () => {
    const env = {
      ASSETS: { fetch: async () => new Response("game") },
      AI_WORLDS: { get: async () => null, put: async () => {} },
      FEEDBACK: { put: async () => {} },
      AI_LIMITER: { limit: async () => ({ success: true }) },
      ASK_LIMITER: { limit: async () => ({ success: false }) },
      GEMINI_API_KEY: "test-key-not-real",
    };
    const response = await worker.fetch(ask(question), env);
    expect(response.status).toBe(429);
  });
});
