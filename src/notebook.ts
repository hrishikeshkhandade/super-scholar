import type { Paper, Question } from "./content/types";
import { noteKey, type Notebook, type NoteKind } from "./save";

// Turns the saved notebook entries into pages the Notebook screen shows.
// Only unlocked items become pages (paging past "???" pages made the Notebook
// hard to get around); each section says in one line what's left to find.

export interface NotePage {
  heading: string;
  text: string;
  question?: Question; // flashcards only
}

export interface NoteSection {
  name: string;
  pages: NotePage[];
  unlocked: number;
  total: number;
  stillLocked?: string; // how to find the rest, if any is left
}

// "1 more fact", "3 more facts".
const more = (count: number, one: string, many: string) => `${count} more ${count === 1 ? one : many}`;

export function worldSections(paper: Paper, worldIndex: number, notebook: Notebook): NoteSection[] {
  const world = paper.worlds[worldIndex];
  const worldName = `World ${worldIndex + 1}`;
  const entries = new Set(notebook[paper.id] ?? []);
  const has = (kind: NoteKind, index: number) => entries.has(noteKey(worldIndex, kind, index));

  const lessons: NotePage[] = [];
  const cards: NotePage[] = [];
  world.cutscenes.forEach((cutscene, i) => {
    if (!has("lesson", i)) return;
    cutscene.pages.forEach((text, page) =>
      lessons.push({ heading: `LESSON ${i + 1}: ${cutscene.title} (${page + 1}/${cutscene.pages.length})`, text }),
    );
    if (cutscene.practice) cards.push({ heading: `PRACTICE ${i + 1}`, text: "", question: cutscene.practice });
  });
  world.boss.questions.forEach((question, i) => {
    if (has("boss", i)) cards.push({ heading: `BOSS QUESTION ${i + 1}${has("missed", i) ? " (MISSED)" : ""}`, text: "", question });
  });
  const facts = world.facts.flatMap((fact, i) => (has("fact", i) ? [{ heading: `FUN FACT ${i + 1}`, text: fact }] : []));

  const count = (kind: NoteKind, total: number) => {
    let unlocked = 0;
    for (let i = 0; i < total; i++) if (has(kind, i)) unlocked += 1;
    return unlocked;
  };
  const lessonsFound = count("lesson", world.cutscenes.length);
  const factsFound = count("fact", world.facts.length);
  const practiceTotal = world.cutscenes.filter((c) => c.practice).length;
  const practiceFound = world.cutscenes.filter((c, i) => c.practice && has("lesson", i)).length;
  const bossFound = count("boss", world.boss.questions.length);

  const lessonsLeft = world.cutscenes.length - lessonsFound;
  const factsLeft = world.facts.length - factsFound;
  const practiceLeft = practiceTotal - practiceFound;
  const bossLeft = world.boss.questions.length - bossFound;
  const cardSources = [
    ...(practiceLeft > 0 ? [`clear ${worldName}'s levels`] : []),
    ...(bossLeft > 0 ? [`face ${world.boss.name}`] : []),
  ].join(" and ");
  return [
    {
      name: "LESSONS",
      pages: lessons,
      unlocked: lessonsFound,
      total: world.cutscenes.length,
      stillLocked: lessonsLeft > 0 ? `${more(lessonsLeft, "lesson unlocks", "lessons unlock")} as you reach the flags in ${worldName}.` : undefined,
    },
    {
      name: "FACTS",
      pages: facts,
      unlocked: factsFound,
      total: world.facts.length,
      stillLocked: factsLeft > 0 ? `${more(factsLeft, "fact", "facts")}: stomp bears in ${worldName} to find ${factsLeft === 1 ? "it" : "them"}.` : undefined,
    },
    {
      name: "CARDS",
      pages: cards,
      unlocked: practiceFound + bossFound,
      total: practiceTotal + world.boss.questions.length,
      stillLocked: cardSources ? `${more(practiceLeft + bossLeft, "card unlocks", "cards unlock")} as you ${cardSources}.` : undefined,
    },
  ];
}

// How much of a paper (or one world) the player has unlocked, e.g. for "5/31".
export function progressOf(sections: NoteSection[]): { unlocked: number; total: number } {
  return sections.reduce(
    (sum, section) => ({ unlocked: sum.unlocked + section.unlocked, total: sum.total + section.total }),
    { unlocked: 0, total: 0 },
  );
}

export function paperProgress(paper: Paper, notebook: Notebook): { unlocked: number; total: number } {
  return progressOf(paper.worlds.flatMap((_, i) => worldSections(paper, i, notebook)));
}

// The LEVEL CLEAR line telling the player what this level added to the
// Notebook, so they know it exists and what's in it.
export function savedNotesLine(factCount: number, hasFlashcard: boolean): string {
  const facts = factCount === 1 ? "1 FACT" : `${factCount} FACTS`;
  const saved = ["LESSON", ...(hasFlashcard ? ["FLASHCARD"] : []), ...(factCount > 0 ? [facts] : [])];
  const list = saved.length === 1 ? saved[0] : `${saved.slice(0, -1).join(", ")} & ${saved[saved.length - 1]}`;
  return `${list} SAVED TO YOUR NOTEBOOK`;
}
