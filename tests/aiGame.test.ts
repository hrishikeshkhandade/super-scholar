import { afterEach, describe, expect, it, vi } from "vitest";
import { handleAiGame } from "../server/aiGame";

// A fake Gemini: answers with whatever reply the test queues up next.
function fakeGemini(replies: (object | "fail")[]) {
  let calls = 0;
  vi.stubGlobal("fetch", async () => {
    const reply = replies[Math.min(calls++, replies.length - 1)];
    if (reply === "fail") return new Response("busy", { status: 503 });
    return Response.json({ candidates: [{ content: { parts: [{ text: JSON.stringify(reply) }] } }] });
  });
  return () => calls;
}

const question = (n: number) => ({
  question: `Why does idea ${n} matter?`,
  choices: [`Right ${n}`, `Wrong A ${n}`, `Wrong B ${n}`, `Wrong C ${n}`],
  answer: 0,
  explanation: `Because of idea ${n}.`,
});
const goodWorld = {
  name: "Leafy Lab",
  lessons: [1, 2, 3].map((n) => ({ title: `Lesson ${n}`, pages: ["One.", "Two.", "Three."], practice: question(n) })),
  facts: ["Fact one!", "Fact two!"],
  boss: [4, 5, 6, 7, 8].map(question),
};

const request = () =>
  new Request("https://game.test/api/ai-game", {
    method: "POST",
    body: JSON.stringify({ title: "Plants", abstract: "", sections: [{ heading: "Light", excerpt: "Light splits water." }] }),
  });

afterEach(() => vi.unstubAllGlobals());

describe("AI game server", () => {
  it("retries a world that failed every AI the first time", async () => {
    // First pass: both Gemini models fail. Second pass: the first one works.
    const calls = fakeGemini(["fail", "fail", goodWorld]);
    const response = await handleAiGame(request(), { geminiKey: "test-key-not-real" });
    const data = (await response.json()) as { worlds: unknown[] };
    expect(data.worlds[0]).toMatchObject({ name: "Leafy Lab" });
    expect(calls()).toBe(3);
  });

  it("gives up after the retry and lets the game fall back to rules", async () => {
    fakeGemini(["fail"]);
    const response = await handleAiGame(request(), { geminiKey: "test-key-not-real" });
    expect(await response.json()).toEqual({ worlds: [null], cached: false });
  });
});
