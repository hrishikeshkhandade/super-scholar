import { handleAiGame } from "../server/aiGame";
import { handleAskScholar } from "../server/askScholar";
import { handleFeedback } from "../server/feedback";
import { handleFetchPaper } from "../server/fetchPaper";
import { handleLeaderboard, type BoardStore } from "../server/leaderboard";
import type { BoardEntry } from "../src/leaderboard";

// The Cloudflare Worker behind the site. Game files (HTML, JS, images) are
// served straight from Cloudflare's static assets; only /api/ requests run
// this code: paper downloads, AI-written worlds, the Scholar's answers,
// classmate feedback, and each paper's leaderboard.

interface RateLimiter {
  limit(options: { key: string }): Promise<{ success: boolean }>;
}

interface Env {
  ASSETS: { fetch(request: Request): Promise<Response> };
  AI_WORLDS: {
    get(key: string, type: "json"): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
  FEEDBACK: { put(key: string, value: string): Promise<void> };
  LEADERBOARD: {
    get(key: string, type: "json"): Promise<unknown>;
    put(key: string, value: string, options?: { metadata?: unknown }): Promise<void>;
    list(options: { prefix: string; cursor?: string }): Promise<{
      keys: { name: string; metadata?: unknown }[];
      list_complete: boolean;
      cursor?: string;
    }>;
  };
  DOWNLOAD_LIMITER?: RateLimiter;
  FEEDBACK_LIMITER?: RateLimiter;
  AI_LIMITER?: RateLimiter;
  ASK_LIMITER?: RateLimiter;
  LEADERBOARD_LIMITER?: RateLimiter;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
}

// Security headers for responses made here (the _headers file covers the
// game's static files, but Cloudflare doesn't apply it to worker responses).
const API_HEADERS: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "strict-origin-when-cross-origin",
  "cross-origin-resource-policy": "same-origin",
};

function withHeaders(response: Response): Response {
  const copy = new Response(response.body, response);
  for (const [name, value] of Object.entries(API_HEADERS)) copy.headers.set(name, value);
  return copy;
}

// Each visitor (by IP address) gets a limited number of calls a minute, so
// nobody can hammer other servers or burn through the shared AI quota.
async function allowed(limiter: RateLimiter | undefined, request: Request): Promise<boolean> {
  if (!limiter) return true;
  const ip = request.headers.get("cf-connecting-ip") ?? "unknown";
  return (await limiter.limit({ key: ip })).success;
}

// Each entry is kept in its key's metadata too, so one list call returns
// the whole board without a read per entry.
function boardStore(kv: Env["LEADERBOARD"]): BoardStore {
  return {
    get: async (key) => (await kv.get(key, "json")) as BoardEntry | null,
    put: (key, entry) => kv.put(key, JSON.stringify(entry), { metadata: entry }),
    list: async (prefix) => {
      const entries: BoardEntry[] = [];
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix, cursor });
        for (const key of page.keys) if (key.metadata) entries.push(key.metadata as BoardEntry);
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return entries;
    },
  };
}

const tooMany = () => Response.json({ error: "Too many requests. Wait a minute and try again." }, { status: 429 });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/fetch-paper") {
      if (!(await allowed(env.DOWNLOAD_LIMITER, request))) return withHeaders(tooMany());
      return withHeaders(await handleFetchPaper(request));
    }
    if (pathname === "/api/ai-game") {
      if (!(await allowed(env.AI_LIMITER, request))) return withHeaders(tooMany());
      const store = {
        get: (key: string) => env.AI_WORLDS.get(key, "json"),
        put: (key: string, value: string) => env.AI_WORLDS.put(key, value),
      };
      return withHeaders(await handleAiGame(request, { geminiKey: env.GEMINI_API_KEY, groqKey: env.GROQ_API_KEY, store }));
    }
    if (pathname === "/api/ask-scholar") {
      // Its own limit, so players asking questions can't use up the quota
      // that writing new papers' worlds needs.
      if (!(await allowed(env.ASK_LIMITER, request))) return withHeaders(tooMany());
      return withHeaders(await handleAskScholar(request, { geminiKey: env.GEMINI_API_KEY, groqKey: env.GROQ_API_KEY }));
    }
    if (pathname === "/api/leaderboard") {
      // Reading is free; adding a score is limited per visitor.
      if (request.method === "POST" && !(await allowed(env.LEADERBOARD_LIMITER, request))) return withHeaders(tooMany());
      return withHeaders(await handleLeaderboard(request, boardStore(env.LEADERBOARD)));
    }
    if (pathname === "/api/feedback") {
      if (!(await allowed(env.FEEDBACK_LIMITER, request))) return withHeaders(tooMany());
      return withHeaders(await handleFeedback(request, env.FEEDBACK));
    }
    if (pathname.startsWith("/api/")) return withHeaders(Response.json({ error: "Not found." }, { status: 404 }));
    return env.ASSETS.fetch(request);
  },
};
