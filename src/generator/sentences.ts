// Splits text into sentences and keeps the ones that read well on their own.

const ABBREVIATIONS = ["e.g.", "i.e.", "et al.", "etc.", "Fig.", "Figs.", "Eq.", "Eqs.", "vs.", "cf.", "U.S.", "Dr.", "No.", "approx."];
const PLACEHOLDER = "\u0000";

export function splitSentences(text: string): string[] {
  let protectedText = text;
  for (const abbreviation of ABBREVIATIONS) {
    protectedText = protectedText.split(abbreviation).join(abbreviation.replaceAll(".", PLACEHOLDER));
  }
  return protectedText
    .split(/(?<=[.!?])\s+(?=[A-Z“"(])/)
    .map((sentence) => sentence.replaceAll(PLACEHOLDER, ".").trim())
    .filter((sentence) => sentence.length > 0);
}

export const MIN_SENTENCE_CHARS = 50;
export const MAX_SENTENCE_CHARS = 180;

// Rejects fragments, math-heavy lines, figure captions, and citation lists,
// which make confusing lessons.
export function isReadable(sentence: string): boolean {
  if (sentence.length < MIN_SENTENCE_CHARS || sentence.length > MAX_SENTENCE_CHARS) return false;
  if (sentence.split(/\s+/).length < 8) return false;
  if (!/[.!?]$/.test(sentence) || /:$/.test(sentence)) return false;
  if (/^(fig(ure)?|table|eq(uation)?)\b/i.test(sentence) || /^[(\[]/.test(sentence)) return false;
  if (/\b(figure|table)\s+\d+\s*:/i.test(sentence) || /[{}]/.test(sentence)) return false;
  const tokens = sentence.split(/\s+/);
  // Loose single letters ("X t", "R i") are pieces of broken-up math.
  if (tokens.filter((token) => /^[A-Za-zα-ω]$/.test(token) && !/^(a|A|I)$/.test(token)).length >= 2) return false;
  // Mostly Capitalized Words is usually a table row or a list of names.
  if (tokens.filter((token) => /^[A-Z]/.test(token)).length / tokens.length > 0.5) return false;
  // Symbols outside normal text usually mean a math glyph the PDF lost.
  if (/[^\x20-\x7E\u00C0-\u024F“”‘’–—…]/.test(sentence)) return false;
  const visible = sentence.replace(/\s/g, "");
  const letters = (visible.match(/[A-Za-z]/g) ?? []).length;
  if (letters / visible.length < 0.8) return false;
  if ((sentence.match(/[=+∑∫√≤≥×∈∂]/g) ?? []).length > 1) return false;
  if ((sentence.match(/\(\d{4}\)|\[\d+\]/g) ?? []).length > 2) return false;
  return true;
}
