import { SCHOLAR_PROMPT, parseScholarAnswer, parseScholarQuestion, scholarPrompt } from "../src/scholar";
import { GROQ_MODEL, describe, jsonError, parseJson, providers, type AiKeys, type AiOptions } from "./aiProviders";

// Answers a player's question about a lesson, from the first free AI that
// gives a usable answer. The player is waiting, so the fast Groq model goes
// first (Gemini sometimes took 12-15 seconds in testing), and a slow AI is
// given up on quickly. It also leaves Gemini's quota for writing new papers.

const MAX_BODY_CHARS = 6_000;
const AI_OPTIONS: AiOptions = { timeoutMs: 8_000, maxTokens: 300 };

function scholarOrder(keys: AiKeys) {
  const ais = providers(keys, AI_OPTIONS);
  const groq = ais.findIndex((ai) => ai.name === GROQ_MODEL);
  if (groq > 0) ais.unshift(...ais.splice(groq, 1));
  return ais;
}

export async function handleAskScholar(request: Request, keys: AiKeys): Promise<Response> {
  if (request.method !== "POST") return jsonError(405, "Only POST requests are allowed.");
  const ais = scholarOrder(keys);
  if (ais.length === 0) return jsonError(503, "No AI is set up.");
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return jsonError(413, "That question is too long.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return jsonError(400, "Not valid JSON.");
  }
  const question = parseScholarQuestion(body);
  if (!question) return jsonError(400, "Not a valid question.");

  for (const ai of ais) {
    try {
      const answer = parseScholarAnswer(parseJson(await ai.ask(SCHOLAR_PROMPT, scholarPrompt(question))));
      if (answer) return Response.json({ answer }, { headers: { "cache-control": "no-store" } });
      console.warn(`${ai.name}: unusable Scholar answer`);
    } catch (failure) {
      console.warn(`${ai.name}: Scholar answer failed: ${describe(failure)}`);
    }
  }
  return jsonError(503, "The Scholar couldn't answer right now.");
}
