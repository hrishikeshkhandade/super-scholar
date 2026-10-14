import type { Cutscene, Paper, Question, World } from "../content/types";
import { MAX_ABSTRACT_CHARS, MAX_EXCERPT_CHARS, MAX_TITLE_CHARS, type AiRequest } from "./aiWorlds";
import { MAX_FACT_CHARS, MAX_PAGE_CHARS, validatePaper } from "../content/validate";
import { LEVEL_LAYOUTS } from "../levels/layouts";
import { containsTerm, findKeyTerms, type Term } from "./keywords";
import { hashString, makeQuestion, seededRandom } from "./questions";
import { cleanHeading, outlinePaper, type Section } from "./sections";
import { isReadable, splitSentences } from "./sentences";
import type { TextLine } from "./textLines";

// Builds a whole game from a paper's text with plain rules, no AI:
// sections become worlds, the most important sentences become lessons,
// and key terms become fill-in-the-blank questions. It also picks out each
// section's key sentences for the AI, which rewrites the worlds in plain
// words when it's available (the rules version is the fallback).

export class GenerateError extends Error {}

const SPEAKER = "PROF. QUANT";
const MAX_WORLDS = 5;
const PAGES_PER_LESSON = 4;
const BOSS_QUESTIONS = 5;
const MIN_WORLD_SENTENCES = 6;
const MAX_WORLD_NAME = 44;

interface ScoredSentence {
  text: string;
  position: number;
  score: number;
}

function shorten(text: string, max: number): string {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  return `${cut.slice(0, cut.lastIndexOf(" ")).trimEnd()}...`;
}

function scoreSentences(text: string, terms: Term[]): ScoredSentence[] {
  return splitSentences(text)
    .map((sentence, position) => ({ text: sentence, position, score: 0 }))
    .filter((sentence) => isReadable(sentence.text))
    .map((sentence) => {
      const termScore = terms.filter((term) => containsTerm(sentence.text, term)).reduce((sum, t) => sum + t.score, 0);
      // Opening sentences of a section usually state its main idea.
      const openingBonus = sentence.position < 2 ? 1.3 : 1;
      return { ...sentence, score: (termScore / Math.sqrt(sentence.text.split(" ").length)) * openingBonus };
    });
}

// Too many sections: combine neighbours so there are at most MAX_WORLDS worlds.
function groupSections(sections: Section[]): Section[] {
  if (sections.length <= MAX_WORLDS) return sections;
  const perWorld = Math.ceil(sections.length / MAX_WORLDS);
  const groups: Section[] = [];
  for (let i = 0; i < sections.length; i += perWorld) {
    const group = sections.slice(i, i + perWorld);
    groups.push({ heading: group[0].heading, text: group.map((s) => s.text).join(" ") });
  }
  return groups;
}

// No headings found: cut the text into equal parts instead.
function splitIntoParts(text: string, parts: number): Section[] {
  const sentences = splitSentences(text);
  const size = Math.ceil(sentences.length / parts);
  const sections: Section[] = [];
  for (let i = 0; i < parts && i * size < sentences.length; i++) {
    sections.push({ heading: `Part ${i + 1}`, text: sentences.slice(i * size, (i + 1) * size).join(" ") });
  }
  return sections;
}

function makeFacts(sentences: ScoredSentence[], terms: Term[], worldText: string): string[] {
  // Sentences with real numbers (not "equation (3)" or "Figure 9") make the
  // best "did you know" facts.
  const hasNumber = (text: string) => /\d/.test(text.replace(/\(\d+\)|\b(section|figure|table|equation)\s+\d+/gi, ""));
  const withNumbers = sentences.filter((s) => hasNumber(s.text) && s.text.length <= MAX_FACT_CHARS);
  const short = sentences.filter((s) => s.text.length <= MAX_FACT_CHARS && !withNumbers.includes(s));
  // "...shown in Figure 3" only makes sense next to the figure, so those go last.
  const mentionsFigure = (s: ScoredSentence) => /\b(fig(ure)?s?|tables?)\.?\s*\d/i.test(s.text);
  const ranked = [...withNumbers, ...short].sort((a, b) => Number(mentionsFigure(a)) - Number(mentionsFigure(b)));
  const facts = ranked.slice(0, 6).map((s) => s.text);
  if (facts.length > 0) return facts;
  return terms
    .filter((term) => containsTerm(worldText, term))
    .slice(0, 3)
    .map((term) => `"${term.text}" is one of the key terms in this part of the paper.`);
}

function buildWorld(section: Section, index: number, terms: Term[], seed: number): World | undefined {
  const sentences = scoreSentences(section.text, terms);
  if (sentences.length < MIN_WORLD_SENTENCES) return undefined;
  const random = seededRandom(seed + index);

  const lessonCount = LEVEL_LAYOUTS.length;
  const best = [...sentences]
    .sort((a, b) => b.score - a.score)
    .slice(0, lessonCount * PAGES_PER_LESSON)
    .sort((a, b) => a.position - b.position);
  const perLesson = Math.ceil(best.length / lessonCount);
  const used = new Set<string>();

  const cutscenes: Cutscene[] = [];
  const titleTerms = new Set<Term>();
  for (let i = 0; i < lessonCount; i++) {
    const chunk = best.slice(i * perLesson, (i + 1) * perLesson);
    if (chunk.length === 0) break;
    const mainTerm = terms.find((term) => !titleTerms.has(term) && chunk.some((s) => containsTerm(s.text, term)));
    if (mainTerm) titleTerms.add(mainTerm);
    let practice: Question | undefined;
    for (const sentence of chunk) {
      practice = makeQuestion(sentence.text, terms, random);
      if (practice) {
        used.add(sentence.text);
        break;
      }
    }
    cutscenes.push({
      title: mainTerm ? `Key idea: ${mainTerm.text}` : `Lesson ${i + 1}`,
      speaker: SPEAKER,
      pages: chunk.map((s) => s.text),
      practice,
    });
  }

  // Boss questions come from the section's strongest sentences not already used.
  const questions: Question[] = [];
  for (const sentence of [...sentences].sort((a, b) => b.score - a.score)) {
    if (questions.length >= BOSS_QUESTIONS) break;
    if (used.has(sentence.text)) continue;
    const question = makeQuestion(sentence.text, terms, random);
    if (question) questions.push(question);
  }
  if (questions.length < 2) return undefined;

  const heading = cleanHeading(section.heading);
  return {
    id: `world-${index + 1}`,
    name: shorten(`World ${index + 1}: ${heading}`, MAX_WORLD_NAME),
    section: heading,
    cutscenes,
    facts: makeFacts(sentences, terms, section.text),
    boss: { name: "THE PEER REVIEWER", questions },
  };
}

const worldLabel = (world: World) => world.name.replace(/^World \d+:\s*/, "");

function introPages(title: string, abstract: string, worlds: World[], pageCount: number, byAi: boolean): string[] {
  const worldList = worlds.map(byAi ? worldLabel : (world) => world.section).join(", ");
  const pages = [
    shorten(`Welcome, scholar! Today's paper: "${title}".`, MAX_PAGE_CHARS),
    shorten(`It is ${pageCount} pages long. I turned it into ${worlds.length} world${worlds.length === 1 ? "" : "s"}: ${worldList}.`, MAX_PAGE_CHARS),
  ];
  const summary = splitSentences(abstract).find(isReadable);
  if (summary && !byAi) pages.push(shorten(`In short: ${summary}`, MAX_PAGE_CHARS));
  pages.push(
    byAi
      ? "An AI helped me explain this paper in plain words. AI can slip up, so check anything important against the paper."
      : "I built these lessons straight from the paper's own sentences, with no AI, so a few may read a little rough.",
    "Move with A and D, jump with W. Stomp bears for fun facts, and reach each flag for a lesson. Go!",
  );
  return pages;
}

// A section's strongest sentences, in reading order, for the AI to teach from.
function excerptFor(section: Section, terms: Term[]): string {
  const best = scoreSentences(section.text, terms).sort((a, b) => b.score - a.score);
  const chosen: ScoredSentence[] = [];
  let length = 0;
  for (const sentence of best) {
    if (length + sentence.text.length + 1 > MAX_EXCERPT_CHARS) continue;
    chosen.push(sentence);
    length += sentence.text.length + 1;
  }
  return chosen
    .sort((a, b) => a.position - b.position)
    .map((s) => s.text)
    .join(" ");
}

// Everything needed to finish the game once the AI answers (or doesn't).
export interface PreparedGame {
  paper: Paper; // the rules-only version, always playable
  aiRequest: AiRequest; // what to send the AI, one entry per section
  ruleWorlds: (World | undefined)[]; // the rules world for each section, if any
  pageCount: number;
}

// Swaps in the AI's worlds where it wrote one, keeping the rules world for
// any section it didn't. Falls back to the rules version if none came back.
export function withAiWorlds(prepared: PreparedGame, aiWorlds: (World | undefined)[]): Paper {
  if (!aiWorlds.some((world) => world !== undefined)) return prepared.paper;
  const worlds = prepared.ruleWorlds
    .map((ruleWorld, i) => aiWorlds[i] ?? ruleWorld)
    .filter((world): world is World => world !== undefined)
    .map((world, i) => ({ ...world, id: `world-${i + 1}`, name: shorten(`World ${i + 1}: ${worldLabel(world)}`, MAX_WORLD_NAME) }));
  const { paper } = prepared;
  const intro = { ...paper.intro, pages: introPages(paper.title, paper.summary, worlds, prepared.pageCount, true) };
  const merged: Paper = { ...paper, intro, worlds };
  return validatePaper(merged).length === 0 ? merged : paper;
}

export function generateGame(lines: TextLine[], fileName: string): Paper {
  return prepareGame(lines, fileName).paper;
}

export function prepareGame(lines: TextLine[], fileName: string): PreparedGame {
  const text = lines.map((line) => line.text).join(" ");
  if (text.replace(/\s/g, "").length < 800) {
    throw new GenerateError("This PDF has almost no text to read. It may be a scanned image.");
  }

  const outline = outlinePaper(lines);
  const title = outline.title ?? fileName.replace(/\.pdf$/i, "");
  const usable = outline.sections.filter((section) => section.text.length > 400);
  const sections = groupSections(usable.length >= 2 ? usable : splitIntoParts(text, 3));

  // Key terms come only from clean sentences, so table and math text can't
  // turn into quiz answers.
  const readableText = sections.map((section) => splitSentences(section.text).filter(isReadable).join(" "));
  const terms = findKeyTerms(readableText);
  if (terms.length < 8) throw new GenerateError("Couldn't find enough key terms in this paper to make questions.");

  const seed = hashString(title);
  const ruleWorlds = sections.map((section, i) => buildWorld(section, i, terms, seed));
  const worlds = ruleWorlds
    .filter((world): world is World => world !== undefined)
    .map((world, i) => ({ ...world, id: `world-${i + 1}`, name: shorten(`World ${i + 1}: ${world.section}`, MAX_WORLD_NAME) }));
  if (worlds.length === 0) {
    throw new GenerateError("Couldn't find enough readable sentences. The PDF's text may be garbled.");
  }

  const pageCount = Math.max(...lines.map((line) => line.page), 1);
  const yearMatch = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(lines.filter((line) => line.page === 1).map((l) => l.text).join(" "));
  const paper: Paper = {
    id: `upload-${hashString(title + text.length)}`,
    title,
    authors: [],
    year: yearMatch ? Number(yearMatch[1]) : new Date().getFullYear(),
    subject: "Uploaded PDF",
    summary: outline.abstract,
    intro: { title: "A New Quest", speaker: SPEAKER, pages: introPages(title, outline.abstract, worlds, pageCount, false) },
    worlds,
  };

  // The rules above should always produce valid content; this is a safety net.
  const problems = validatePaper(paper);
  if (problems.length > 0) throw new GenerateError(`Generated game failed checks: ${problems[0]}`);

  const aiRequest: AiRequest = {
    title: title.slice(0, MAX_TITLE_CHARS),
    abstract: outline.abstract.slice(0, MAX_ABSTRACT_CHARS),
    sections: sections.map((section) => ({
      heading: cleanHeading(section.heading).slice(0, MAX_TITLE_CHARS) || "Untitled section",
      excerpt: excerptFor(section, terms),
    })),
  };
  return { paper, aiRequest, ruleWorlds, pageCount };
}
