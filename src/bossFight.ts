import type { Question } from "./content/types";

export type BossOutcome = "fighting" | "won" | "lost";

// Rules of a boss fight, kept separate from drawing so they can be tested.
// Each question is one hit point: a right answer damages the boss, a wrong
// answer costs the player a life and the question comes back later.
export class BossFight {
  readonly maxHealth: number;
  health: number;
  lives: number;
  private queue: Question[];

  constructor(questions: Question[], lives: number) {
    this.queue = [...questions];
    this.maxHealth = questions.length;
    this.health = questions.length;
    this.lives = lives;
  }

  get current(): Question | undefined {
    return this.outcome === "fighting" ? this.queue[0] : undefined;
  }

  get outcome(): BossOutcome {
    if (this.health <= 0) return "won";
    if (this.lives <= 0) return "lost";
    return "fighting";
  }

  answer(choiceIndex: number): boolean {
    const question = this.current;
    if (!question) return false;
    this.queue.shift();
    const correct = choiceIndex === question.answerIndex;
    if (correct) {
      this.health -= 1;
    } else {
      this.lives -= 1;
      this.queue.push(question);
    }
    return correct;
  }
}
