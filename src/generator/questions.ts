import type { Question } from "../content/types";
import { containsTerm, termPattern, type Term } from "./keywords";

// Fill-in-the-blank questions: hide a key term in a sentence from the paper
// and offer it alongside three other key terms from the same paper.

const BLANK = "_____";
const MAX_PROMPT_CHARS = 170;
const MAX_EXPLANATION_CHARS = 170;

// A small seeded random generator, so the same paper always gets the same
// questions (and tests are repeatable).
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}

export function hashString(text: string): number {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return hash >>> 0;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}...`;
}

export function makeQuestion(sentence: string, terms: Term[], random: () => number): Question | undefined {
  const answer = terms.find((term) => containsTerm(sentence, term));
  if (!answer) return undefined;

  // Blank every mention, so the answer isn't given away later in the sentence.
  const blanked = sentence.replace(termPattern(answer, "gi"), BLANK);
  const prompt = `Fill in the blank: ${blanked}`;
  if (prompt.length > MAX_PROMPT_CHARS) return undefined;

  // Distractors: other key terms that aren't in the sentence, preferring ones
  // shaped like the answer (same number of words) so the answer doesn't stand out.
  const answerWords = answer.key.split(" ").length;
  const candidates = terms.filter((term) => term !== answer && !containsTerm(sentence, term));
  const sameShape = candidates.filter((term) => term.key.split(" ").length === answerWords);
  const pool = sameShape.length >= 3 ? sameShape : candidates;
  const distractors: Term[] = [];
  const remaining = [...pool];
  while (distractors.length < 3 && remaining.length > 0) {
    distractors.push(remaining.splice(Math.floor(random() * remaining.length), 1)[0]);
  }
  if (distractors.length < 3) return undefined;

  const choices = [answer, ...distractors].map((term) => capitalize(term.text));
  // Shuffle so the answer isn't always first.
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }
  return {
    prompt,
    choices,
    answerIndex: choices.indexOf(capitalize(answer.text)),
    explanation: shorten(`The paper says: "${sentence}"`, MAX_EXPLANATION_CHARS),
  };
}
