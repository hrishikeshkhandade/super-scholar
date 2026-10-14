import { describe, expect, it } from "vitest";
import { validatePaper } from "../src/content/validate";
import { MAX_AI_SECTIONS, parseAiRequest, parseAiWorld, worldPrompt } from "../src/generator/aiWorlds";
import { prepareGame, withAiWorlds } from "../src/generator/generateGame";
import { fakePaper } from "./fixtures/fakePaper";

const question = (n: number) => ({
  question: `Why does idea ${n} matter for the plant?`,
  choices: [`Right answer ${n}`, `Wrong A ${n}`, `Wrong B ${n}`, `Wrong C ${n}`],
  answer: 0,
  explanation: `Because idea ${n} is how the plant gets energy.`,
});

// What a good AI reply looks like.
function aiReply() {
  return {
    name: "World 2: Leafy Power Plant",
    lessons: [1, 2, 3].map((n) => ({
      title: `Lesson ${n}`,
      pages: [`Page one of lesson ${n}.`, `Page two of lesson ${n}.`, `Page three of lesson ${n}.`],
      practice: question(n),
    })),
    facts: ["Plants fix about 120 billion tonnes of carbon a year!", "Rubisco may be the most common protein on Earth."],
    boss: [4, 5, 6, 7, 8].map(question),
  };
}

const section = { heading: "The light reactions", excerpt: "Light splits water and releases oxygen." };

describe("AI request checks", () => {
  const good = { title: "How Plants Make Food", abstract: "About plants.", sections: [section] };

  it("accepts a normal request", () => {
    expect(parseAiRequest(good)).toEqual(good);
  });

  it("rejects requests that are malformed or too big", () => {
    expect(parseAiRequest(null)).toBeUndefined();
    expect(parseAiRequest({ ...good, title: "" })).toBeUndefined();
    expect(parseAiRequest({ ...good, sections: [] })).toBeUndefined();
    expect(parseAiRequest({ ...good, sections: Array(MAX_AI_SECTIONS + 1).fill(section) })).toBeUndefined();
    expect(parseAiRequest({ ...good, sections: [{ heading: "x", excerpt: "y".repeat(5000) }] })).toBeUndefined();
    expect(parseAiRequest({ ...good, sections: [{ heading: 5, excerpt: "y" }] })).toBeUndefined();
  });

  it("puts the excerpt in the prompt as data", () => {
    const prompt = worldPrompt(good, 0);
    expect(prompt).toContain("<excerpt>\nLight splits water and releases oxygen.\n</excerpt>");
    expect(prompt).toContain('"The light reactions"');
  });
});

describe("AI world checks", () => {
  it("turns a good reply into a playable world", () => {
    const world = parseAiWorld(aiReply(), section, 1)!;
    expect(world.name).toBe("World 2: Leafy Power Plant");
    expect(world.cutscenes).toHaveLength(3);
    expect(world.boss.questions).toHaveLength(5);
    expect(world.facts).toHaveLength(2);
    // Choices are shuffled, but the answer still points at the right one.
    for (const q of [...world.cutscenes.map((c) => c.practice!), ...world.boss.questions]) {
      expect(q.choices[q.answerIndex]).toMatch(/^Right answer/);
    }
    const answerSpots = new Set(world.boss.questions.map((q) => q.answerIndex));
    expect(answerSpots.size).toBeGreaterThan(1);
  });

  it("rejects replies the game can't use", () => {
    const broken = [
      undefined,
      "not json",
      { ...aiReply(), name: "" },
      { ...aiReply(), lessons: aiReply().lessons.slice(0, 2) },
      { ...aiReply(), facts: ["Only one fact."] },
      { ...aiReply(), boss: [question(1), question(2)] },
    ];
    for (const reply of broken) expect(parseAiWorld(reply, section, 0)).toBeUndefined();
  });

  it("rejects a lesson whose question is broken", () => {
    const bad = [
      { ...question(1), answer: 4 },
      { ...question(1), choices: ["Same", "same", "Other", "Another"] },
      { ...question(1), choices: ["Only one"] },
      { ...question(1), question: "x".repeat(300) },
    ];
    for (const practice of bad) {
      const reply = aiReply();
      reply.lessons[0].practice = practice;
      expect(parseAiWorld(reply, section, 0)).toBeUndefined();
    }
  });

  it("drops pages and facts that are too long to fit on screen", () => {
    const reply = aiReply();
    reply.lessons[0].pages.push("x ".repeat(150));
    reply.facts.push("y ".repeat(100));
    const world = parseAiWorld(reply, section, 0)!;
    expect(world.cutscenes[0].pages).toHaveLength(3);
    expect(world.facts).toHaveLength(2);
  });
});

describe("mixing AI worlds into a game", () => {
  const prepared = prepareGame(fakePaper(), "plants.pdf");

  it("sends the AI each section's key sentences, not the whole paper", () => {
    expect(prepared.aiRequest.sections.map((s) => s.heading)).toEqual(["Introduction", "The light reactions", "The Calvin cycle"]);
    for (const s of prepared.aiRequest.sections) expect(s.excerpt.length).toBeGreaterThan(100);
    expect(parseAiRequest(prepared.aiRequest)).toBeDefined();
  });

  it("uses AI worlds where they came back and rules worlds elsewhere", () => {
    const aiWorld = parseAiWorld(aiReply(), prepared.aiRequest.sections[1], 1);
    const paper = withAiWorlds(prepared, [undefined, aiWorld, undefined]);
    expect(validatePaper(paper)).toEqual([]);
    expect(paper.worlds.map((w) => w.name)).toEqual([
      prepared.paper.worlds[0].name,
      "World 2: Leafy Power Plant",
      prepared.paper.worlds[2].name,
    ]);
    expect(paper.intro.pages.join(" ")).toContain("An AI helped me");
  });

  it("keeps the rules version when the AI sent nothing", () => {
    expect(withAiWorlds(prepared, [])).toBe(prepared.paper);
    expect(prepared.paper.intro.pages.join(" ")).toContain("with no AI");
  });
});
