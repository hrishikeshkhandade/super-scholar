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

const END_HEADINGS = /^(\d+\.?\s*)?(references|bibliography|acknowledg(e)?ments?|appendix|recommended reading|further reading|notes|competing interests|conflicts? of interest|funding|author contributions|data availability)\b/i;
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

// Words seen in the middle of a line. Line-break fragments like "mov-" or
// "fer" only ever appear at the end or start of a line, so they're left out.
function wordSet(lines: TextLine[]): Set<string> {
  const words = new Set<string>();
  for (const line of lines) {
    const tokens = line.text.split(/\s+/);
    tokens.slice(1, line.text.endsWith("-") ? -1 : undefined).forEach((token) => {
      for (const word of token.toLowerCase().match(/[a-z]+/g) ?? []) words.add(word);
    });
  }
  return words;
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

  // Heading levels come from font size: the biggest size used for at least
  // two headings is the main level (one world each), and smaller heading
  // sizes are subsections folded into their parent. An author name or page
  // number in a bigger font then can't become a world.
  const candidate = (line: TextLine) =>
    line.size >= body * 1.12 && line.text.length <= 90 && !titleLines.includes(line);
  const sizeCounts = new Map<number, number>();
  for (const line of lines.filter(candidate)) sizeCounts.set(line.size, (sizeCounts.get(line.size) ?? 0) + 1);
  const topSize = [...sizeCounts].filter(([, count]) => count >= 2).sort((a, b) => b[0] - a[0])[0]?.[0];
  const useNumbered = topSize === undefined;
  const sameSize = (a: number, b: number) => Math.abs(a - b) < 0.5;

  // Papers that number their sections: only numbered (or standard) lines
  // count as main headings.
  const topLines = lines.filter((line) => candidate(line) && topSize !== undefined && sameSize(line.size, topSize));
  const strict = topLines.filter((line) => NUMBERED_HEADING.test(line.text)).length >= 2;
  const isTop = (line: TextLine) =>
    useNumbered
      ? line.size >= body && NUMBERED_HEADING.test(line.text) && isTopLevel(line.text)
      : topLines.includes(line) && (!strict || NUMBERED_HEADING.test(line.text) || STANDARD_HEADING.test(line.text));
  const isSub = (line: TextLine) =>
    useNumbered
      ? line.size >= body && NUMBERED_HEADING.test(line.text) && !isTopLevel(line.text)
      : candidate(line) && !topLines.includes(line);
  // A long heading wraps onto a second line of the same size.
  const continues = (heading: string, line: TextLine) =>
    topLines.includes(line) &&
    !NUMBERED_HEADING.test(line.text) &&
    (/[-,:]$/.test(heading) || /\b(of|the|and|a|an|in|for|to|with|on|from|by|its|their)$/i.test(heading) || /^[a-z]/.test(line.text));

  const sections: Section[] = [];
  const abstractLines: string[] = [];
  let heading: string | undefined;
  let buffer: string[] = [];
  let inAbstract = false;
  let previousWasTop = false;

  const flush = () => {
    if (heading && buffer.length > 0) sections.push({ heading, text: joinLines(buffer, vocabulary) });
    buffer = [];
  };

  for (const line of lines) {
    if (titleLines.includes(line)) continue;
    // Smaller text is figure captions and footnotes, which interrupt sentences.
    if (line.size < body * 0.88) continue;
    if (/^abstract\b/i.test(line.text) && !heading) {
      inAbstract = true;
      const rest = line.text.replace(/^abstract[\s.:—-]*/i, "");
      if (rest) abstractLines.push(rest);
      continue;
    }
    const top = isTop(line);
    const sub = !top && isSub(line);
    // References and other end matter stop the lessons, whatever their size
    // or numbering (some papers set "References" in plain bold body text).
    const standaloneReferences = /^(\d+\.?\s*)?(references|bibliography)$/i.test(line.text);
    if (standaloneReferences || ((top || sub || candidate(line)) && END_HEADINGS.test(line.text))) break;
    if (top) {
      if (previousWasTop && heading && continues(heading, line)) {
        heading = heading.endsWith("-") ? heading + line.text : `${heading} ${line.text}`;
      } else {
        flush();
        heading = line.text;
      }
      inAbstract = false;
      previousWasTop = true;
      continue;
    }
    previousWasTop = false;
    if (sub) continue; // subsection titles aren't lesson text
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
