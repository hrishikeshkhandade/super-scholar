import type { FeedbackStoryProps } from "./scenes/FeedbackStory";

// The classmate feedback the narration tells: paraphrased from PLAN.md's Done
// list (2026-10-20), with the classmate unnamed, as in the public copy. The
// screenshot is from the play-through checks. "SO NOW" appears as the student
// says "So now you collect them...".
export const FACTS_STORY: FeedbackStoryProps = {
  heard: "Fun facts popping up while I play are distracting.",
  fix: "Stomps just show +FACT. You read them after the level.",
  image: "stills/facts-found.png",
  fixAt: 5.9,
};
