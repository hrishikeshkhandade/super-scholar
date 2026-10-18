import { RATING_QUESTIONS, TEXT_QUESTIONS } from "../src/feedbackQuestions";

// Classmate feedback sent from the game's FEEDBACK screen. Everything is
// checked before it's saved: ratings must be 1-5, text is length-limited,
// and an empty form is refused. Nothing identifying is collected beyond an
// optional first name the player chooses to type.

export const MAX_ANSWER_CHARS = 300;
export const MAX_NAME_CHARS = 40;
const MAX_BODY_CHARS = 4000;

export interface Feedback {
  ratings: Partial<Record<(typeof RATING_QUESTIONS)[number], number>>;
  answers: Partial<Record<(typeof TEXT_QUESTIONS)[number], string>>;
  name?: string;
  device: "touch" | "keyboard";
}

export interface FeedbackStore {
  put(key: string, value: string): Promise<void>;
}

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function parseFeedback(value: unknown): Feedback | undefined {
  const body = value as Record<string, unknown>;
  if (typeof body !== "object" || body === null) return undefined;
  const ratingsIn = (body.ratings ?? {}) as Record<string, unknown>;
  const answersIn = (body.answers ?? {}) as Record<string, unknown>;
  if (typeof ratingsIn !== "object" || typeof answersIn !== "object") return undefined;

  const ratings: Feedback["ratings"] = {};
  for (const question of RATING_QUESTIONS) {
    const rating = ratingsIn[question];
    if (rating === undefined || rating === null) continue;
    if (!Number.isInteger(rating) || (rating as number) < 1 || (rating as number) > 5) return undefined;
    ratings[question] = rating as number;
  }
  const answers: Feedback["answers"] = {};
  for (const question of TEXT_QUESTIONS) {
    const answer = answersIn[question];
    if (answer === undefined || answer === null || answer === "") continue;
    if (typeof answer !== "string" || answer.length > MAX_ANSWER_CHARS) return undefined;
    if (clean(answer)) answers[question] = clean(answer);
  }
  let name: string | undefined;
  if (body.name !== undefined && body.name !== null && body.name !== "") {
    if (typeof body.name !== "string" || body.name.length > MAX_NAME_CHARS) return undefined;
    name = clean(body.name) || undefined;
  }
  if (Object.keys(ratings).length === 0 && Object.keys(answers).length === 0) return undefined;
  const device = body.device === "touch" ? "touch" : "keyboard";
  return { ratings, answers, ...(name ? { name } : {}), device };
}

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "cache-control": "no-store" } });
}

export async function handleFeedback(request: Request, store: FeedbackStore): Promise<Response> {
  if (request.method !== "POST") return error(405, "Only POST requests are allowed.");
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS) return error(413, "That feedback is too long.");
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return error(400, "Not valid JSON.");
  }
  const feedback = parseFeedback(body);
  if (!feedback) return error(400, "Please rate something or write an answer.");
  // Keys sort by time, so reading them back lists feedback in order.
  const key = `${new Date().toISOString()}-${crypto.randomUUID().slice(0, 8)}`;
  await store.put(key, JSON.stringify({ ...feedback, receivedAt: new Date().toISOString() }));
  return Response.json({ saved: true }, { headers: { "cache-control": "no-store" } });
}
