import type { TextLine } from "./textLines";

// Finds the title and the sections of a paper from its lines of text.
// Headings are usually in a bigger font than the body; when a PDF doesn't
// do that, numbered lines like "3 Results" are used instead.

export interface Section {
  heading: string;
  text: string;
}

export interface PaperOutline {
  title: string | undefined;
  abstract: string;
  sections: Section[];
}

const END_HEADINGS = /^(\d+\.?\s*)?(references|bibliography|acknowledg(e)?ments?|appendix)\b/i;
const NUMBERED_HEADING = /^(\d+(\.\d+)*\.?|[IVX]+\.)\s+[A-Z][^.!?]{2,70}$/;
const STANDARD_HEADING = /^(introduction|background|related work|methods?|results|discussion|conclusions?|summary)\b/i;

// The font size used by most of the text, weighted by how much text uses it.
export function bodyFontSize(lines: TextLine[]): number {
  const weight = new Map<number, number>();
  for (const line of lines) weight.set(line.size, (weight.get(line.size) ?? 0) + line.text.length);
  let best = 0;
  let bestWeight = -1;
  for (const [size, total] of weight) {
    if (total > bestWeight) [best, bestWeight] = [size, total];
  }
  return best;
}

// Page numbers and running headers/footers that repeat on many pages.
function removeNoise(lines: TextLine[]): TextLine[] {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line.text, (counts.get(line.text) ?? 0) + 1);
  return lines.filter((line) => !/^\d{1,4}$/.test(line.text) && (counts.get(line.text) ?? 0) < 3);
}

function isTopLevel(heading: string): boolean {
  return !/^\d+\.\d+/.test(heading);
}

// A word split across lines: "mean-" + "reverting" stays "mean-reverting"
// because both halves are real words in the paper, but "mov-" + "ing"
// becomes "moving".
export function joinLines(lines: string[], vocabulary: Set<string>): string {
  let text = "";
  for (const line of lines) {
    const hyphenated = /([A-Za-z]+)-$/.exec(text);
    const nextWord = /^([a-z]+)/.exec(line);
    const bothWords = hyphenated && nextWord && vocabulary.has(hyphenated[1].toLowerCase()) && vocabulary.has(nextWord[1]);
    if (hyphenated && nextWord && !bothWords) {
      text = text.slice(0, -1) + line;
    } else {
      text += (text && !text.endsWith("-") ? " " : "") + line;
    }
  }
  return text.replace(/\s+/g, " ").trim();
}

// Words that appear at least twice, so line-break fragments like "mov" don't count.
function wordSet(lines: TextLine[]): Set<string> {
  const counts = new Map<string, number>();
  for (const line of lines) {
    for (const word of line.text.toLowerCase().match(/[a-z]+/g) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return new Set([...counts].filter(([word, count]) => count >= 2 && word.length >= 2).map(([word]) => word));
}

export function outlinePaper(allLines: TextLine[]): PaperOutline {
  const lines = removeNoise(allLines);
  const body = bodyFontSize(lines);
  const vocabulary = wordSet(lines);

  // Title: the biggest text on the first page.
  const firstPage = lines.filter((line) => line.page === 1 && line.text.length > 3);
  const titleSize = Math.max(...firstPage.map((line) => line.size), 0);
  const titleLines = firstPage.filter((line) => line.size === titleSize);
  const title = titleSize > body * 1.15 ? titleLines.map((line) => line.text).join(" ") : undefined;

  const bigLine = (line: TextLine) =>
    line.size >= body * 1.12 && line.text.length <= 90 && !titleLines.includes(line);
  const bigLines = lines.filter(bigLine);
  const numberedBig = bigLines.filter((line) => NUMBERED_HEADING.test(line.text));
  // Papers that number their sections: only numbered (or standard) big lines
  // are headings, so author names and dates in a big font are skipped.
  const strict = numberedBig.length >= 2;
  const bigHeading = (line: TextLine) =>
    bigLine(line) && (!strict || NUMBERED_HEADING.test(line.text) || STANDARD_HEADING.test(line.text));
  const useNumbered = bigLines.length < 2;
  const isHeading = (line: TextLine) =>
    useNumbered ? line.size >= body && NUMBERED_HEADING.test(line.text) : bigHeading(line);

  const sections: Section[] = [];
  const abstractLines: string[] = [];
  let heading: string | undefined;
  let buffer: string[] = [];
  let inAbstract = false;
  let previousWasHeading = false;

  const flush = () => {
    if (heading && buffer.length > 0) {
      const text = joinLines(buffer, vocabulary);
      const last = sections[sections.length - 1];
      // Subsections (2.1, 2.2...) are folded into their parent section.
      if (last && !isTopLevel(heading)) last.text += ` ${text}`;
      else sections.push({ heading, text });
    }
    buffer = [];
  };

  for (const line of lines) {
    if (titleLines.includes(line)) continue;
    if (/^abstract\b/i.test(line.text) && !heading) {
      inAbstract = true;
      const rest = line.text.replace(/^abstract[\s.:—-]*/i, "");
      if (rest) abstractLines.push(rest);
      continue;
    }
    const continuesHeading = previousWasHeading && bigLine(line) && !NUMBERED_HEADING.test(line.text);
    if (isHeading(line) || continuesHeading) {
      if (END_HEADINGS.test(line.text)) break;
      // A heading that wraps onto a second line continues the same heading.
      if (previousWasHeading && heading && !NUMBERED_HEADING.test(line.text)) heading += ` ${line.text}`;
      else {
        flush();
        heading = line.text;
      }
      inAbstract = false;
      previousWasHeading = true;
      continue;
    }
    previousWasHeading = false;
    if (inAbstract) abstractLines.push(line.text);
    else if (heading) buffer.push(line.text);
  }
  flush();

  return { title, abstract: joinLines(abstractLines, vocabulary), sections };
}

// "2 A quantitative view of risk-factors" -> "A quantitative view of risk-factors"
export function cleanHeading(heading: string): string {
  return heading.replace(/^(\d+(\.\d+)*\.?|[IVX]+\.)\s+/, "").trim();
}
