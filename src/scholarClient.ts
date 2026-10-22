import { parseScholarAnswer, type ScholarQuestion } from "./scholar";

// Sends a question to the server's Scholar and turns every outcome into
// something the professor can say: an answer, or a plain-words problem.

const ASK_TIMEOUT_MS = 30_000;

export type ScholarReply = { answer: string } | { problem: string };

export async function askScholar(question: ScholarQuestion): Promise<ScholarReply> {
  try {
    const response = await fetch("/api/ask-scholar", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(question),
      signal: AbortSignal.timeout(ASK_TIMEOUT_MS),
    });
    if (response.status === 429) return { problem: "Phew, lots of questions! Give me a minute, then ask again." };
    if (!response.ok) return { problem: "My brain's a bit foggy right now. Try again in a moment." };
    const answer = parseScholarAnswer(await response.json());
    return answer ? { answer } : { problem: "Hmm, I lost my train of thought. Could you ask that again?" };
  } catch {
    return { problem: "I can't reach the library right now. Check your connection and try again." };
  }
}
