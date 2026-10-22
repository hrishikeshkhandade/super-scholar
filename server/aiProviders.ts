// The free AIs the server can ask, shared by the world writer (aiGame.ts)
// and the Scholar's answers (askScholar.ts). The API keys are secret
// settings on the server and never reach the browser. Every AI is asked for
// JSON, and several are tried in turn because each has its own free quota.

const GEMINI_MODELS = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
export const GROQ_MODEL = "llama-3.3-70b-versatile";

export interface AiKeys {
  geminiKey?: string;
  groqKey?: string;
}

export interface AiOptions {
  timeoutMs: number;
  maxTokens: number;
}

export type Ask = (system: string, user: string) => Promise<string>;

function gemini(model: string, key: string, { timeoutMs, maxTokens }: AiOptions): Ask {
  return async (system, user) => {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${model} answered ${response.status}`);
    const data = await response.json();
    const parts: { text?: string }[] = data?.candidates?.[0]?.content?.parts ?? [];
    return parts.map((part) => part.text ?? "").join("");
  };
}

function groq(key: string, { timeoutMs, maxTokens }: AiOptions): Ask {
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
        max_tokens: maxTokens,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`${GROQ_MODEL} answered ${response.status}`);
    const data = await response.json();
    return data?.choices?.[0]?.message?.content ?? "";
  };
}

// The AIs to try, best first. One without a key is skipped.
export function providers({ geminiKey, groqKey }: AiKeys, options: AiOptions): { name: string; ask: Ask }[] {
  const list: { name: string; ask: Ask }[] = [];
  if (geminiKey) for (const model of GEMINI_MODELS) list.push({ name: model, ask: gemini(model, geminiKey, options) });
  if (groqKey) list.push({ name: GROQ_MODEL, ask: groq(groqKey, options) });
  return list;
}

export const describe = (failure: unknown) => (failure instanceof Error ? failure.message : String(failure));

// Some models wrap JSON in ``` fences even when asked not to.
export function parseJson(text: string): unknown {
  return JSON.parse(text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
}

export function jsonError(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
