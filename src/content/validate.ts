import type { Paper, Question } from "./types";

// Limits that keep content fitting on screen and playable. Used by the tests
// for hand-written papers and by the generator for papers made from PDFs.
export const MAX_PAGE_CHARS = 190;
export const MAX_FACT_CHARS = 120;
export const MAX_CHOICES = 4;

function questionProblems(question: Question, where: string): string[] {
  const problems: string[] = [];
  if (!question.prompt.trim()) problems.push(`${where}: empty prompt`);
  if (question.choices.length < 2 || question.choices.length > MAX_CHOICES) {
    problems.push(`${where}: needs 2-${MAX_CHOICES} choices`);
  }
  if (!Number.isInteger(question.answerIndex) || question.answerIndex < 0 || question.answerIndex >= question.choices.length) {
    problems.push(`${where}: answer index out of range`);
  }
  if (new Set(question.choices.map((choice) => choice.toLowerCase())).size !== question.choices.length) {
    problems.push(`${where}: duplicate choices`);
  }
  return problems;
}

// Returns a list of problems; an empty list means the paper is playable.
export function validatePaper(paper: Paper): string[] {
  const problems: string[] = [];
  const checkPages = (pages: string[], where: string) => {
    if (pages.length === 0) problems.push(`${where}: no pages`);
    pages.forEach((page, i) => {
      if (page.length > MAX_PAGE_CHARS) problems.push(`${where} page ${i + 1}: longer than ${MAX_PAGE_CHARS} characters`);
    });
  };

  checkPages(paper.intro.pages, "intro");
  if (paper.worlds.length === 0) problems.push("no worlds");
  paper.worlds.forEach((world, w) => {
    const name = `world ${w + 1}`;
    if (world.cutscenes.length === 0) problems.push(`${name}: no lessons`);
    world.cutscenes.forEach((cutscene, c) => {
      checkPages(cutscene.pages, `${name} lesson ${c + 1}`);
      if (cutscene.practice) problems.push(...questionProblems(cutscene.practice, `${name} lesson ${c + 1} practice`));
    });
    if (world.facts.length === 0) problems.push(`${name}: no facts`);
    world.facts.forEach((fact, f) => {
      if (fact.length > MAX_FACT_CHARS) problems.push(`${name} fact ${f + 1}: longer than ${MAX_FACT_CHARS} characters`);
    });
    if (world.boss.questions.length === 0) problems.push(`${name}: boss has no questions`);
    world.boss.questions.forEach((question, q) => problems.push(...questionProblems(question, `${name} boss question ${q + 1}`)));
  });
  return problems;
}
