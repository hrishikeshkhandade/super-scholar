import type { FeedbackStoryProps } from "./scenes/FeedbackStory";

// Classmate feedback that changed the game, paraphrased from PLAN.md's Done
// list (2026-10-20, 10-30 and 10-29). Classmates stay unnamed, as in the
// public copy. Screenshots are from the play-through checks.
export const FEEDBACK_STORIES: FeedbackStoryProps[] = [
  {
    heard: "Fun facts popping up while I play are distracting.",
    fix: "Stomps just show +FACT. You read them after the level.",
    image: "stills/facts-found.png",
  },
  {
    heard: "A boss question came back. Is that a glitch?",
    fix: "Missed questions now say they come back, with a tag.",
    image: "stills/boss-retry.png",
  },
  {
    heard: "What is the Notebook even for?",
    fix: "LEVEL CLEAR says what it saved to your Notebook.",
    image: "stills/level-clear-saved.png",
  },
];
