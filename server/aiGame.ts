import { PROMPT_VERSION, SYSTEM_PROMPT, parseAiRequest, parseAiWorld, worldPrompt, type AiRequest } from "../src/generator/aiWorlds";
import { describe, jsonError, parseJson, providers, type AiKeys, type AiOptions, type Ask } from "./aiProviders";

// Asks a free AI to write a paper's worlds in plain words (the AIs
// themselves are in aiProviders.ts).
//
// To keep the free quotas going as long as possible:
// - each paper's result is saved, so the same paper never costs AI twice;
// - several free models are tried in turn (each has its own quota);
// - each visitor is rate-limited (by the worker that calls this);
// - only each section's key sentences are sent, not the whole PDF.
// If every AI fails, the game falls back to its rules-made worlds.

const MAX_BODY_CHARS = 40_000;
const AI_OPTIONS: AiOptions = { timeoutMs: 45_000, maxTokens: 4096 };

// Where finished results are saved (Cloudflare KV on the live site).
export interface ResultStore {
  get(key: string): Promise<unknown>;
  put(key: string, value: string): Promise<void>;
}

export interface AiGameSettings extends AiKeys {
  store?: ResultStore;
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

  const ais = providers(settings, AI_OPTIONS);
  const worlds = await Promise.all(request.sections.map((_, i) => writeWorld(request, i, ais)));
  // A world can fail once by bad luck (a busy AI, an answer that breaks a
  // rule), so give any missing ones a second try before falling back.
  const missing = worlds.map((world, i) => (world === null && request.sections[i].excerpt.trim() ? i : -1)).filter((i) => i >= 0);
  const retried = await Promise.all(missing.map((i) => writeWorld(request, i, ais)));
  missing.forEach((i, n) => (worlds[i] = retried[n]));
  // Only complete results are saved, so a later try can fill any gaps.
  if (worlds.every((world, i) => world !== null || !request.sections[i].excerpt.trim())) {
    await store?.put(key, JSON.stringify({ worlds })).catch((failure) => console.warn(`couldn't save result: ${describe(failure)}`));
  }
  return { worlds, cached: false };
}

export async function handleAiGame(request: Request, settings: AiGameSettings): Promise<Response> {
  if (request.method !== "POST") return jsonError(405, "Only POST requests are allowed.");
  if (providers(settings, AI_OPTIONS).length === 0) return jsonError(503, "No AI is set up.");
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return jsonError(413, "That paper excerpt is too long.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Not valid JSON.");
  }
  const aiRequest = parseAiRequest(body);
  if (!aiRequest) return jsonError(400, "Not a valid paper excerpt.");
  const result = await worldsFor(aiRequest, settings).catch(() => ({ worlds: [], cached: false }));
  return Response.json(result, { headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
