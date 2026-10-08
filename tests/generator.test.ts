import { describe, expect, it } from "vitest";
import { validatePaper } from "../src/content/validate";
import { GenerateError, generateGame } from "../src/generator/generateGame";
import { findKeyTerms } from "../src/generator/keywords";
import { makeQuestion, seededRandom } from "../src/generator/questions";
import { joinLines, outlinePaper } from "../src/generator/sections";
import { isReadable, splitSentences } from "../src/generator/sentences";
import { linesFromItems, type TextLine } from "../src/generator/textLines";

// A small fake paper: big title, numbered headings, body text, references.
const SECTIONS: Record<string, string[]> = {
  "1 Introduction": [
    "Photosynthesis converts light energy into chemical energy stored in glucose molecules.",
    "Green plants perform photosynthesis inside chloroplasts using the pigment chlorophyll.",
    "The light reactions capture photons and split water molecules to release oxygen gas.",
    "Chlorophyll absorbs red and blue light while reflecting green light back to our eyes.",
    "Without photosynthesis, almost no oxygen would exist in the atmosphere of the planet.",
    "Early experiments showed that chloroplasts alone can perform the light reactions in a dish.",
    "Scientists measured that plants fix about 120 billion tonnes of carbon every year.",
    "The study of photosynthesis connects biology, chemistry, and physics in one process.",
  ],
  "2 The light reactions": [
    "The light reactions take place in the thylakoid membranes of the chloroplasts.",
    "Photosystem II absorbs light first and passes excited electrons down a transport chain.",
    "The electron transport chain pumps protons and builds a gradient across the membrane.",
    "ATP synthase uses the proton gradient to produce ATP for the rest of the cell.",
    "Photosystem I then re-energizes the electrons so they can reduce NADPH molecules.",
    "Splitting water replaces the electrons lost by photosystem II during the light reactions.",
    "The oxygen released by the light reactions comes entirely from the split water molecules.",
    "About 30 percent of absorbed light energy ends up stored as ATP and NADPH.",
  ],
  "3 The Calvin cycle": [
    "The Calvin cycle uses ATP and NADPH from the light reactions to fix carbon dioxide.",
    "The enzyme rubisco attaches carbon dioxide to a five-carbon sugar called RuBP.",
    "Rubisco is probably the most abundant protein on Earth because plants need so much of it.",
    "Each turn of the Calvin cycle fixes one molecule of carbon dioxide into the sugar chain.",
    "Six turns of the Calvin cycle are needed to build one molecule of glucose for the plant.",
    "The Calvin cycle runs in the stroma, the fluid that surrounds the thylakoid membranes.",
    "When rubisco grabs oxygen instead of carbon dioxide, the plant wastes energy and carbon.",
    "Some plants evolved special leaf anatomy so rubisco sees more carbon dioxide than oxygen.",
  ],
};

function fakePaper(): TextLine[] {
  const lines: TextLine[] = [{ text: "How Plants Make Food From Light", size: 18, page: 1 }];
  let page = 1;
  for (const [heading, sentences] of Object.entries(SECTIONS)) {
    lines.push({ text: heading, size: 14, page });
    for (const sentence of sentences) lines.push({ text: sentence, size: 10, page });
    page += 1;
  }
  lines.push({ text: "References", size: 14, page });
  lines.push({ text: "Smith J. A very important reference about photosynthesis and rubisco in plants.", size: 10, page });
  return lines;
}

describe("generateGame", () => {
  const paper = generateGame(fakePaper(), "plants.pdf");

  it("makes a playable game that passes every content rule", () => {
    expect(validatePaper(paper)).toEqual([]);
  });

  it("finds the title and turns each section into a world, stopping at References", () => {
    expect(paper.title).toBe("How Plants Make Food From Light");
    expect(paper.worlds.map((world) => world.section)).toEqual(["Introduction", "The light reactions", "The Calvin cycle"]);
    const allPages = paper.worlds.flatMap((world) => world.cutscenes.flatMap((c) => c.pages)).join(" ");
    expect(allPages).not.toContain("Smith J.");
  });

  it("asks fill-in-the-blank questions whose answer really was in the sentence", () => {
    for (const world of paper.worlds) {
      for (const question of world.boss.questions) {
        expect(question.prompt).toContain("_____");
        const answer = question.choices[question.answerIndex].toLowerCase();
        expect(question.explanation.toLowerCase()).toContain(answer);
      }
    }
  });

  it("stops at a References line set in plain body-size text", () => {
    const lines = fakePaper().filter((line) => line.text !== "References" && !line.text.startsWith("Smith"));
    lines.push({ text: "References", size: 10, page: 9 });
    lines.push({ text: "Jones K. Proceedings of the Annual Meeting on chloroplasts and rubisco enzymes.", size: 10, page: 9 });
    expect(JSON.stringify(generateGame(lines, "plants.pdf").worlds)).not.toContain("Annual Meeting");
  });

  it("gives the same game for the same paper every time", () => {
    expect(generateGame(fakePaper(), "plants.pdf")).toEqual(paper);
  });

  it("explains clearly when a PDF has no readable text", () => {
    const scanned = [{ text: "Scanned page", size: 10, page: 1 }];
    expect(() => generateGame(scanned, "scan.pdf")).toThrow(GenerateError);
    expect(() => generateGame(scanned, "scan.pdf")).toThrow(/scanned image/);
  });
});

describe("generator pieces", () => {
  it("doesn't split sentences at abbreviations", () => {
    expect(splitSentences("We use e.g. rubisco in the U.S. today. Then it works.")).toEqual([
      "We use e.g. rubisco in the U.S. today.",
      "Then it works.",
    ]);
  });

  it("rejects broken math, captions, and table rows", () => {
    expect(isReadable("Chlorophyll absorbs red and blue light while reflecting green light back.")).toBe(true);
    expect(isReadable("Let us denote by { R i } i =1 the returns of the different stocks here today.")).toBe(false);
    expect(isReadable("Figure 3: The light reactions shown in a diagram of the thylakoid membrane.")).toBe(false);
    expect(isReadable("Top Stocks Bottom Stocks Utility Semiconductor Energy Corp Banks Retail Oil.")).toBe(false);
  });

  it("rejoins words split across lines but keeps real hyphenated words", () => {
    const vocabulary = new Set(["mean", "reverting", "moving", "average"]);
    expect(joinLines(["a mean-", "reverting process"], vocabulary)).toBe("a mean-reverting process");
    expect(joinLines(["a mov-", "ing average"], vocabulary)).toBe("a moving average");
  });

  it("blanks every mention of the answer", () => {
    const sentences = Object.values(SECTIONS).flat();
    const terms = findKeyTerms(Object.values(SECTIONS).map((s) => s.join(" ")));
    const sentence = "The Calvin cycle runs fast, and the Calvin cycle needs ATP from the light reactions.";
    const question = makeQuestion(sentence, terms, seededRandom(1));
    expect(sentences.length).toBeGreaterThan(0);
    expect(question).toBeDefined();
    expect(question!.prompt).not.toMatch(new RegExp(question!.choices[question!.answerIndex], "i"));
    expect(new Set(question!.choices).size).toBe(4);
  });

  it("groups pdf.js text pieces into lines with their font size", () => {
    const lines = linesFromItems(
      [
        { str: "Big", transform: [14, 0, 0, 14, 50, 700] },
        { str: "Title", transform: [14, 0, 0, 14, 90, 700], hasEOL: true },
        { str: "Body text", transform: [10, 0, 0, 10, 50, 680] },
      ],
      1,
    );
    expect(lines).toEqual([
      { text: "Big Title", size: 14, page: 1 },
      { text: "Body text", size: 10, page: 1 },
    ]);
  });

  it("skips big author lines when sections are numbered", () => {
    const outline = outlinePaper([
      { text: "A Paper Title", size: 18, page: 1 },
      { text: "Ada Lovelace and Alan Turing", size: 12, page: 1 },
      ...fakePaper().slice(1),
    ]);
    expect(outline.sections[0].heading).toBe("1 Introduction");
  });

  it("uses font-size levels: big author names, captions, and end matter don't become lessons", () => {
    // Like the Portland Press photosynthesis paper: unnumbered headings in two
    // sizes, the author in a medium font, small captions mid-section.
    const lines: TextLine[] = [
      { text: "How Plants Make Food From Light", size: 25, page: 1 },
      { text: "Ada Lovelace", size: 12, page: 1 },
    ];
    Object.entries(SECTIONS).forEach(([heading, sentences], i) => {
      lines.push({ text: heading.replace(/^\d+ /, ""), size: 20, page: i + 1 });
      lines.push({ text: "A subsection title", size: 15, page: i + 1 });
      sentences.forEach((sentence, j) => {
        lines.push({ text: sentence, size: 10, page: i + 1 });
        if (j === 3) lines.push({ text: "Figure 2. A caption about rubisco that interrupts the text.", size: 7, page: i + 1 });
      });
    });
    lines.push({ text: "Competing Interests", size: 15, page: 9 });
    lines.push({ text: "The author declares that there are no competing interests associated with the manuscript.", size: 10, page: 9 });

    const paper = generateGame(lines, "plants.pdf");
    expect(paper.worlds.map((world) => world.section)).toEqual(["Introduction", "The light reactions", "The Calvin cycle"]);
    const text = JSON.stringify(paper.worlds);
    expect(text).not.toContain("Ada Lovelace");
    expect(text).not.toContain("caption");
    expect(text).not.toContain("declares");
    expect(text).not.toContain("A subsection title");
  });
});
