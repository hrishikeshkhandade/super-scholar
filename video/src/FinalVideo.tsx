import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Fragment } from "react";
import { clipEnd, Narration, type NarrationClip } from "./components/Narration";
import { FACTS_STORY } from "./feedbackStories";
import {
  BOSS_VOICE,
  ENDING_VOICE,
  FEEDBACK_VOICE,
  INTRO_VOICE,
  LEVEL_VOICE,
  PLAN_VOICE,
  REVIEW_VOICE,
  TESTS_VOICE,
} from "./narration";
import { Ending } from "./scenes/Ending";
import { FeedbackStory } from "./scenes/FeedbackStory";
import { Intro } from "./scenes/Intro";
import { PlanScroll } from "./scenes/PlanScroll";
import { ProjectStats } from "./scenes/ProjectStats";
import { SectionCard } from "./scenes/SectionCard";
import { TestRun, testRunSeconds } from "./scenes/TestRun";
import {
  Walkthrough,
  walkthroughFrames,
  type WalkthroughProps,
} from "./scenes/Walkthrough";
import {
  BOSS_FIGHT_RUN,
  REVIEW_NOTEBOOK_RUN,
  UPLOADED_PAPER_RUN,
} from "./walkthroughs";

export const FPS = 30;
const TRANSITION_FRAMES = 15;
// Quiet after the last spoken phrase before a scene moves on.
const VOICE_TAIL_SECONDS = 0.5;

// Scene lengths in frames, for scenes that aren't sized by their content.
// A scene with narration also grows to fit it (see `scene` below).
export const SCENES = {
  intro: 6 * FPS,
  section: 3 * FPS,
  plan: 9 * FPS,
  feedback: 7 * FPS,
  testRun: Math.ceil(testRunSeconds() * FPS),
  stats: 4 * FPS,
  // Holds about a second and a half after "Thanks for watching!"
  ending: 11 * FPS,
};

type Scene = { name: string; frames: number; element: React.ReactNode };

// A scene, with any narration laid over it and lengthened to fit it.
const scene = (
  name: string,
  frames: number,
  element: React.ReactNode,
  voice: NarrationClip[] = [],
): Scene => {
  const voiceFrames = Math.ceil(
    (Math.max(0, ...voice.map(clipEnd)) + VOICE_TAIL_SECONDS) * FPS,
  );
  return {
    name,
    frames: voice.length > 0 ? Math.max(frames, voiceFrames) : frames,
    element: (
      <>
        {element}
        <Narration clips={voice} />
      </>
    ),
  };
};

const walkthrough = (
  name: string,
  run: WalkthroughProps,
  voice: NarrationClip[],
): Scene =>
  scene(
    name,
    walkthroughFrames(run.shots, FPS),
    <Walkthrough {...run} voice={voice} />,
    voice,
  );

const card = (part: number, title: string): Scene =>
  scene(
    `Card: ${title}`,
    SCENES.section,
    <SectionCard label={`PART ${part}`} title={title} />,
  );

// The video in order, following ../VIDEO.md: each part opens with a chapter
// card, and the student's narration (src/narration.ts) plays over it.
const VIDEO: Scene[] = [
  scene("Intro", SCENES.intro, <Intro />, INTRO_VOICE),
  card(1, "PLAYING A LEVEL"),
  walkthrough("Walkthrough: uploaded paper", UPLOADED_PAPER_RUN, LEVEL_VOICE),
  card(2, "THE BOSS"),
  walkthrough("Walkthrough: boss fight", BOSS_FIGHT_RUN, BOSS_VOICE),
  card(3, "REVIEW & NOTEBOOK"),
  walkthrough(
    "Walkthrough: review and notebook",
    REVIEW_NOTEBOOK_RUN,
    REVIEW_VOICE,
  ),
  card(4, "HOW I BUILT IT"),
  scene("Plan", SCENES.plan, <PlanScroll />, PLAN_VOICE),
  scene(
    "Feedback: fun facts",
    SCENES.feedback,
    <FeedbackStory {...FACTS_STORY} />,
    FEEDBACK_VOICE,
  ),
  scene("Tests", SCENES.testRun, <TestRun />, TESTS_VOICE),
  scene("Stats", SCENES.stats, <ProjectStats />),
  scene("Ending", SCENES.ending, <Ending />, ENDING_VOICE),
];

// Cards wipe into what follows; everything else fades.
const isCard = (entry: Scene) => entry.name.startsWith("Card:");

export const FINAL_DURATION =
  VIDEO.reduce((total, entry) => total + entry.frames, 0) -
  (VIDEO.length - 1) * TRANSITION_FRAMES;

export const FinalVideo: React.FC = () => (
  <TransitionSeries>
    {VIDEO.map((entry, index) => (
      <Fragment key={entry.name}>
        {index > 0 && isCard(VIDEO[index - 1]) && (
          <TransitionSeries.Transition
            presentation={wipe({ direction: "from-left" })}
            timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          />
        )}
        {index > 0 && !isCard(VIDEO[index - 1]) && (
          <TransitionSeries.Transition
            presentation={fade()}
            timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
          />
        )}
        <TransitionSeries.Sequence
          name={entry.name}
          durationInFrames={entry.frames}
        >
          {entry.element}
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
  </TransitionSeries>
);
