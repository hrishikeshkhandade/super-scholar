// Builds a showcase paper ahead of time, with the same pipeline players use:
// read the PDF, outline it with the rules, ask the live AI to write the worlds,
// and run the game's checks. The result (our own lessons, never the paper's
// text) is saved into src/content/showcase/ and ships with the game.
//
// Usage: npx tsx scripts/makeShowcase.ts <id> <pdf-url> "<title>" "<author; author>" <year> "<subject>" "<summary>"

import { writeFileSync } from "node:fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import type { Paper } from "../src/content/types";
import { validatePaper } from "../src/content/validate";
import { parseAiWorld } from "../src/generator/aiWorlds";
import { prepareGame, withAiWorlds } from "../src/generator/generateGame";
import { linesFromItems, type PdfTextItem, type TextLine } from "../src/generator/textLines";

const AI_URL = "https://super-scholar.super-scholar.workers.dev/api/ai-game";
const MAX_PAGES = 40;

async function readLines(url: string): Promise<TextLine[]> {
  const response = await fetch(url, { headers: { "user-agent": "SuperScholar showcase builder (CS 124 project)" } });
  if (!response.ok) throw new Error(`Download failed: ${response.status}`);
  const pdf = await getDocument({ data: new Uint8Array(await response.arrayBuffer()), enableXfa: false }).promise;
  const lines: TextLine[] = [];
  for (let number = 1; number <= Math.min(pdf.numPages, MAX_PAGES); number++) {
    const content = await (await pdf.getPage(number)).getTextContent();
    lines.push(...linesFromItems(content.items as PdfTextItem[], number));
  }
  return lines;
}

async function main(): Promise<void> {
  const [id, url, title, authors, year, subject, summary] = process.argv.slice(2);
  if (!summary) throw new Error("Usage: makeShowcase <id> <pdf-url> <title> <authors> <year> <subject> <summary>");

  const prepared = prepareGame(await readLines(url), `${title}.pdf`);
  console.log(`Sections: ${prepared.aiRequest.sections.map((s) => s.heading).join(" | ")}`);
  const response = await fetch(AI_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...prepared.aiRequest, title }),
  });
  if (!response.ok) throw new Error(`AI request failed: ${response.status}`);
  const { worlds } = (await response.json()) as { worlds: unknown[] };
  const aiWorlds = prepared.aiRequest.sections.map((section, i) => parseAiWorld(worlds[i], section, i));
  const missing = aiWorlds.filter((world) => !world).length;
  if (missing > 0) throw new Error(`${missing} world(s) didn't come back from the AI; run it again.`);

  const built = withAiWorlds(prepared, aiWorlds);
  const paper: Paper = {
    ...built,
    id,
    title,
    authors: authors.split(";").map((name) => name.trim()),
    year: Number(year),
    subject,
    summary,
    intro: {
      ...built.intro,
      pages: built.intro.pages.map((page) => page.replace(/^Welcome, scholar! Today's paper: ".*"\.$/, `Welcome, scholar! Today's paper: "${title}".`)),
    },
  };
  const problems = validatePaper(paper);
  if (problems.length > 0) throw new Error(`Failed the game's checks: ${problems.join("; ")}`);
  writeFileSync(`src/content/showcase/${id}.json`, `${JSON.stringify(paper, null, 2)}\n`);
  console.log(`Saved ${id}: ${paper.worlds.map((w) => w.name).join(" | ")}`);
}

main().catch((failure) => {
  console.error(failure instanceof Error ? failure.message : failure);
  process.exit(1);
});
