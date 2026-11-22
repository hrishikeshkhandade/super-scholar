import type { NarrationClip } from "./components/Narration";

// Where each phrase of the student's narration plays. `from`/`to` are seconds
// into the cleaned recording (scripts/prepareNarration.sh), cut at its pauses;
// `at` is seconds into the scene, chosen so each phrase lands on what it
// describes (e.g. "Every bear you stomp..." as the first bear is stomped).
const clip = (
  file: string,
  from: number,
  to: number,
  at: number,
): NarrationClip => ({ file, from, to, at });

export const INTRO_VOICE = [clip("1-intro", 1.0, 8.45, 0.4)];

// Over the uploaded-paper walkthrough.
export const LEVEL_VOICE = [
  // "You can pick a paper... Here I uploaded one called Language Models Need Sleep."
  clip("2-level", 0.85, 8.3, 0.3),
  // "AI turns each section into a world... Professor Quant introduces... Then you play."
  clip("2-level", 8.8, 19.8, 7.9),
  // "Every bear you stomp holds a fun fact from the paper."
  clip("2-level", 20.3, 22.95, 19.3),
  // "Reach the flag and you get a short lesson... then a practice question."
  clip("2-level", 23.3, 28.1, 39.0),
  // "Get it right and you earn an extra life." (on CORRECT! +1 LIFE)
  clip("2-level", 28.55, 30.65, 49.9),
];

// Over the boss-fight walkthrough.
export const BOSS_VOICE = [
  // "Every world ends in a boss fight. Stomp the boss, and it asks you a question about the paper."
  clip("3-boss", 1.4, 6.7, 0.5),
  // "A right answer hurts it. A wrong answer makes it angrier." (over the answer and WRONG!)
  clip("3-boss", 6.95, 10.05, 9.4),
  // "And that question comes back later, so you get a second try..." (on the retried question)
  clip("3-boss", 10.55, 14.7, 21.9),
  // "After you win, you can flip through every question you got wrong."
  clip("3-boss", 15.2, 17.95, 26.3),
];

// Over the review-and-notebook walkthrough.
export const REVIEW_VOICE = [
  // "My group gave me an idea... So I added Review. If you've already read the paper..."
  clip("4-review", 0.75, 13.75, 0.2),
  // "Then it tells you which sections you know, and which ones to re-read." (on the results)
  clip("4-review", 14.05, 17.65, 13.4),
  // "And the Notebook keeps every lesson, fact, and question as flashcards..."
  clip("4-review", 18.2, 23.7, 19.1),
];

// How I built it, then "Everything went into a plan file... with the reasons behind my decisions."
export const PLAN_VOICE = [clip("5-built", 0.95, 15.98, 0.4)];

// "The biggest changes came from classmates. One said fun facts... So now you collect them..."
export const FEEDBACK_VOICE = [clip("5-built", 16.4, 24.75, 0.3)];

// "And before any update goes live, it runs 197 tests and plays through the game 21 different ways."
export const TESTS_VOICE = [clip("5-built", 25.2, 30.3, 0.4)];

// "The biggest thing I learned... Try Super Scholar at the link on the screen. Thanks for watching!"
export const ENDING_VOICE = [clip("6-ending", 0.85, 9.98, 0.5)];
