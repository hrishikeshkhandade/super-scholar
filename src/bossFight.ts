import type { Question } from "./content/types";

export const MAX_RAGE = 3;

// Quiz rules of a boss fight, kept separate from the arena so they can be
// tested. Each question is one hit point: a right answer damages the boss.
// A wrong answer enrages it (faster, more attacks) and the question comes
// back later. The player's lives are handled by the arena, not here.
export class BossFight {
  readonly maxHealth: number;
  health: number;
  rage = 0;
  wrongAnswers = 0;
  private queue: Question[];

  constructor(questions: Question[]) {
    this.queue = [...questions];
    this.maxHealth = questions.length;
    this.health = questions.length;
  }

  get current(): Question | undefined {
    return this.defeated ? undefined : this.queue[0];
  }

  get defeated(): boolean {
    return this.health <= 0;
  }

  answer(choiceIndex: number): boolean {
    const question = this.current;
    if (!question) return false;
    this.queue.shift();
    const correct = choiceIndex === question.answerIndex;
    if (correct) {
      this.health -= 1;
    } else {
      this.rage = Math.min(this.rage + 1, MAX_RAGE);
      this.wrongAnswers += 1;
      this.queue.push(question);
    }
    return correct;
  }
}
