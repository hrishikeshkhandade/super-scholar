import type { Paper, Question } from "./content/types";
import { noteKey, type Notebook, type NoteKind } from "./save";

// Turns the saved notebook entries into pages the Notebook screen shows.
// Locked items stay in the list as "???" with a hint, so the player can see
// how much is left to find.

export interface NotePage {
  heading: string;
  text: string; // the hint, for a locked page
  locked: boolean;
  question?: Question; // flashcards only
}

export interface NoteSection {
  name: string;
  pages: NotePage[];
  unlocked: number;
  total: number;
}

const locked = (heading: string, hint: string): NotePage => ({ heading: `${heading}: ???`, text: hint, locked: true });

export function worldSections(paper: Paper, worldIndex: number, notebook: Notebook): NoteSection[] {
  const world = paper.worlds[worldIndex];
  const entries = new Set(notebook[paper.id] ?? []);
  const has = (kind: NoteKind, index: number) => entries.has(noteKey(worldIndex, kind, index));
  const levelName = (index: number) => `${worldIndex + 1}-${index + 1}`;

  const lessons: NotePage[] = [];
  const cards: NotePage[] = [];
  world.cutscenes.forEach((cutscene, i) => {
    const unlocked = has("lesson", i);
    if (unlocked) {
      cutscene.pages.forEach((text, page) =>
        lessons.push({
          heading: `LESSON ${i + 1}: ${cutscene.title} (${page + 1}/${cutscene.pages.length})`,
          text,
          locked: false,
        }),
      );
    } else {
      lessons.push(locked(`LESSON ${i + 1}`, `Reach the flag in level ${levelName(i)} to unlock this lesson.`));
    }
    if (!cutscene.practice) return;
    cards.push(
      unlocked
        ? { heading: `PRACTICE ${i + 1}`, text: "", locked: false, question: cutscene.practice }
        : locked(`PRACTICE ${i + 1}`, `Clear level ${levelName(i)} to unlock this card.`),
    );
  });
  world.boss.questions.forEach((question, i) =>
    cards.push(
      has("boss", i)
        ? { heading: `BOSS QUESTION ${i + 1}`, text: "", locked: false, question }
        : locked(`BOSS QUESTION ${i + 1}`, `Face ${world.boss.name} to unlock this card.`),
    ),
  );
  const facts = world.facts.map((fact, i) =>
    has("fact", i)
      ? { heading: `FUN FACT ${i + 1}`, text: fact, locked: false }
      : locked(`FUN FACT ${i + 1}`, "Stomp bears in this world to find this fact."),
  );

  const count = (kind: NoteKind, total: number) => {
    let unlocked = 0;
    for (let i = 0; i < total; i++) if (has(kind, i)) unlocked += 1;
    return unlocked;
  };
  const practiceCount = world.cutscenes.filter((c, i) => c.practice && has("lesson", i)).length;
  const practiceTotal = world.cutscenes.filter((c) => c.practice).length;
  return [
    { name: "LESSONS", pages: lessons, unlocked: count("lesson", world.cutscenes.length), total: world.cutscenes.length },
    { name: "FACTS", pages: facts, unlocked: count("fact", world.facts.length), total: world.facts.length },
    {
      name: "CARDS",
      pages: cards,
      unlocked: practiceCount + count("boss", world.boss.questions.length),
      total: practiceTotal + world.boss.questions.length,
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
