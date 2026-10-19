import type { World } from "../content/types";
import { parseAiWorld, type AiRequest } from "./aiWorlds";

// Asks the site's AI function to rewrite a paper's worlds. Anything that goes
// wrong (offline, out of quota, a bad answer) just means no AI worlds, and
// the game keeps its rules-made ones.

const AI_TIMEOUT_MS = 90_000; // the server may rewrite worlds that copy the paper

export async function fetchAiWorlds(request: AiRequest, cancel: AbortSignal): Promise<(World | undefined)[]> {
  try {
    const response = await fetch("/api/ai-game", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(request),
      signal: AbortSignal.any([cancel, AbortSignal.timeout(AI_TIMEOUT_MS)]),
    });
    if (!response.ok) return [];
    const data = JSON.parse(await response.text()) as { worlds?: unknown };
    if (!Array.isArray(data.worlds)) return [];
    // The server already checked these, but the game checks again itself.
    const worlds = data.worlds;
    return request.sections.map((section, i) => parseAiWorld(worlds[i], section, i));
  } catch {
    return [];
  }
}
