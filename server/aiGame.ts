import { PROMPT_VERSION, SYSTEM_PROMPT, parseAiRequest, parseAiWorld, worldPrompt, type AiRequest } from "../src/generator/aiWorlds";

// Asks a free AI to write a paper's worlds in plain words. The API keys are
// secret settings on the server and never reach the browser.
//
// To keep the free quotas going as long as possible:
// - each paper's result is saved, so the same paper never costs AI twice;
// - several free models are tried in turn (each has its own quota);
// - each visitor is rate-limited (by the worker that calls this);
// - only each section's key sentences are sent, not the whole PDF.
// If every AI fails, the game falls back to its rules-made worlds.

const MAX_BODY_CHARS = 40_000;
const AI_TIMEOUT_MS = 45_000;
const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
const GROQ_MODEL = "llama-3.3-70b-versatile";

// Where finished results are saved (Cloudflare KV on the live site).
export interface ResultStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface AiGameSettings {
  geminiKey?: string;
  groqKey?: string;
  store?: ResultStore;
}

type Ask = (system: string, user: string) => Promise<string>;

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

function gemini(model: string, key: string): Ask {
  return async (system, user) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: 4096 },
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${model} answered ${response.status}`);
    const data = await response.json();
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((part) => part.text ?? "").join("");
  };
}

function groq(key: string): Ask {
  return async (system, user) => {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
        max_tokens: 4096,
      }),
      signal: AbortSignal.timeout(AI_TIMEOUT_MS),
    });
    if (!response.ok) throw new Error(`${GROQ_MODEL} answered ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  };
}

// The AIs to try, best first. One without a key is skipped.
function providers({ geminiKey, groqKey }: AiGameSettings): { name: string; ask: Ask }[] {
  const list: { name: string; ask: Ask }[] = [];
  if (geminiKey) for (const model of GEMINI_MODELS) list.push({ name: model, ask: gemini(model, geminiKey) });
  if (groqKey) list.push({ name: GROQ_MODEL, ask: groq(groqKey) });
  return list;
}

const describe = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

// Some models wrap JSON in ``` fences even when asked not to.
function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
}

// One world, from the first AI whose answer passes the game's checks.
async function writeWorld(request: AiRequest, index: number, ais: { name: string; ask: Ask }[]): Promise<unknown> {
  const section = request.sections[index];
  if (!section.excerpt.trim()) return null;
  for (const ai of ais) {
    try {
      const world = parseJson(await ai.ask(SYSTEM_PROMPT, worldPrompt(request, index)));
      if (parseAiWorld(world, section, index)) return world;
      console.warn(`${ai.name}: world ${index + 1} failed the game's checks`);
    } catch (failure) {
      // Out of quota, timed out, or not JSON: try the next AI.
      console.warn(`${ai.name}: world ${index + 1}: ${describe(failure)}`);
    }
  }
  return null;
}

async function cacheKey(request: AiRequest): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(request));
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  return `v${PROMPT_VERSION}-${Array.from(digest, (b) => b.toString(16).padStart(2, "0")).join("")}`;
}

async function worldsFor(request: AiRequest, settings: AiGameSettings): Promise<{ worlds: unknown[]; cached: boolean }> {
  // The key is a hash of everything sent, so a request can only ever read
  // or fill the saved result for exactly that same text.
  const key = await cacheKey(request);
  const { store } = settings;
  const saved = (await store?.get(key).catch((failure) => {
    console.warn(`couldn't read saved result: ${describe(failure)}`);
    return undefined;
  })) as { worlds?: unknown[] } | undefined;
  if (Array.isArray(saved?.worlds)) return { worlds: saved.worlds, cached: true };

  const ais = providers(settings);
  const worlds = await Promise.all(request.sections.map((_, i) => writeWorld(request, i, ais)));
  // Only complete results are saved, so a later try can fill any gaps.
  if (worlds.every((world, i) => world !== null || !request.sections[i].excerpt.trim())) {
    await store?.put(key, JSON.stringify({ worlds })).catch((failure) => console.warn(`couldn't save result: ${describe(failure)}`));
  }
  return { worlds, cached: false };
}

export async function handleAiGame(request: Request, settings: AiGameSettings): Promise<Response> {
  if (request.method !== "POST") return error(405, "Only POST requests are allowed.");
  if (providers(settings).length === 0) return error(503, "No AI is set up.");
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return error(413, "That paper excerpt is too long.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "Not valid JSON.");
  }
  const aiRequest = parseAiRequest(body);
  if (!aiRequest) return error(400, "Not a valid paper excerpt.");
  const result = await worldsFor(aiRequest, settings).catch(() => ({ worlds: [], cached: false }));
  return Response.json(result, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
