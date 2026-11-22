import type { WalkthroughProps } from "./scenes/Walkthrough";

// The first recorded play-through (2026-11-21): an uploaded paper, "Language
// Models Need Sleep", from the title screen through level 1-1 to 1-2. Times
// are seconds into public/clips/dreaming-lab.mp4.
export const UPLOADED_PAPER_RUN: WalkthroughProps = {
  clip: "clips/dreaming-lab.mp4",
  shots: [
    { from: 0.5, to: 5.5, speed: 1, caption: "Pick a paper from the library, or upload any PDF." },
    { from: 6, to: 21, speed: 2, caption: "Prof. Quant explains the paper in plain words, then shows you how to play." },
    { from: 22, to: 34, speed: 1, caption: "Stomp bears to collect fun facts from the paper." },
    { from: 34, to: 49.2, speed: 1.5, caption: "Jump the gaps and reach the flag to clear the level." },
    // LEVEL CLEAR and FACTS FOUND flash by in under two seconds, so slow them down to read.
    { from: 49.2, to: 51, speed: 0.6, caption: "The lesson and every fact you found are saved to your Notebook." },
    { from: 51, to: 60, speed: 2, caption: "Then a short lesson teaches one idea from the paper." },
    { from: 60, to: 64.4, speed: 1, caption: "A practice question checks you got it. A right answer earns a life." },
    // Ends before the pause menu the recording stops on.
    { from: 64.5, to: 67.3, speed: 1, caption: "On to the next level." },
  ],
};

// The second recording (2026-11-21): the same paper's World 1 boss, Sir
// Forget-a-Lot, with a wrong answer, hits, retried misses, and the review of
// missed questions after the win. Times are seconds into public/clips/boss.mp4.
export const BOSS_FIGHT_RUN: WalkthroughProps = {
  clip: "clips/boss.mp4",
  shots: [
    { from: 85.8, to: 91.5, speed: 1, caption: "Every world ends in a boss fight." },
    { from: 91.5, to: 97, speed: 1.5, caption: "Stomp the boss and it asks a question about the paper." },
    { from: 97, to: 99.5, speed: 0.8, caption: "A wrong answer makes it angrier, and that question comes back later." },
    // HIT! BOSS TAKES DAMAGE is up for under half a second, so that moment plays at quarter speed.
    { from: 113, to: 115.1, speed: 1, caption: "A right answer hurts the boss." },
    { from: 115.1, to: 115.5, speed: 0.25, caption: "A right answer hurts the boss." },
    { from: 115.5, to: 117.5, speed: 1, caption: "A right answer hurts the boss." },
    { from: 131, to: 137, speed: 2, caption: "Dodge its charge and keep stomping." },
    { from: 150.5, to: 156.8, speed: 1.3, caption: "Missed questions come back as a second try." },
    // Ends on the review of misses, before the next world and the pause menu.
    { from: 162.8, to: 170.5, speed: 1.5, caption: "Win, then flip through every question you missed." },
  ],
};

// The third recording (2026-11-22): REVIEW's missed questions for the same
// paper (both right, so KNOWN), then the Notebook's lessons, facts and cards.
// Times are seconds into public/clips/review-notebook.mp4.
export const REVIEW_NOTEBOOK_RUN: WalkthroughProps = {
  clip: "clips/review-notebook.mp4",
  shots: [
    { from: 1.8, to: 9, speed: 1.5, caption: "Already read the paper? REVIEW skips the levels and goes straight to the bosses." },
    { from: 9, to: 24.5, speed: 3, caption: "MISSED QUESTIONS retests only what you got wrong." },
    { from: 25, to: 29, speed: 1, caption: "Then it scores each section: KNOWN, or which ones to re-read." },
    { from: 29.6, to: 34, speed: 1, caption: "The Notebook keeps every lesson you've unlocked." },
    { from: 34, to: 43, speed: 2.5, caption: "The Notebook keeps every lesson you've unlocked." },
    { from: 60, to: 63, speed: 1, caption: "Fun facts from the bears are saved too." },
    { from: 63, to: 68.5, speed: 1.5, caption: "Every practice and boss question becomes a flashcard to study." },
  ],
};
