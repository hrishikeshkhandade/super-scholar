import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Fragment } from "react";
import { FEEDBACK_STORIES } from "./feedbackStories";
import { Ending } from "./scenes/Ending";
import { FeedbackStory } from "./scenes/FeedbackStory";
import { Intro } from "./scenes/Intro";
import { PlanScroll } from "./scenes/PlanScroll";
import { ProjectStats } from "./scenes/ProjectStats";
import { SectionCard } from "./scenes/SectionCard";
import { TestRun, testRunSeconds } from "./scenes/TestRun";
import { Walkthrough, walkthroughFrames } from "./scenes/Walkthrough";
import {
  BOSS_FIGHT_RUN,
  REVIEW_NOTEBOOK_RUN,
  UPLOADED_PAPER_RUN,
} from "./walkthroughs";

export const FPS = 30;
const TRANSITION_FRAMES = 15;

// Scene lengths in frames, for scenes that aren't sized by their content.
export const SCENES = {
  intro: 6 * FPS,
  section: 3 * FPS,
  plan: 9 * FPS,
  feedback: 7 * FPS,
  testRun: Math.ceil(testRunSeconds() * FPS),
  stats: 5 * FPS,
  ending: 10 * FPS,
};

type Scene = { name: string; frames: number; element: React.ReactNode };

const walkthrough = (name: string, run: typeof UPLOADED_PAPER_RUN): Scene => ({
  name,
  frames: walkthroughFrames(run.shots, FPS),
  element: <Walkthrough {...run} />,
});

const card = (part: number, title: string): Scene => ({
  name: `Card: ${title}`,
  frames: SCENES.section,
  element: <SectionCard label={`PART ${part}`} title={title} />,
});

// The video in order, following the outline in ../VIDEO.md: each part opens
// with a chapter card.
const VIDEO: Scene[] = [
  { name: "Intro", frames: SCENES.intro, element: <Intro /> },
  card(1, "PLAYING A LEVEL"),
  walkthrough("Walkthrough: uploaded paper", UPLOADED_PAPER_RUN),
  card(2, "THE BOSS"),
  walkthrough("Walkthrough: boss fight", BOSS_FIGHT_RUN),
  card(3, "REVIEW & NOTEBOOK"),
  walkthrough("Walkthrough: review and notebook", REVIEW_NOTEBOOK_RUN),
  card(4, "HOW I BUILT IT"),
  { name: "Plan", frames: SCENES.plan, element: <PlanScroll /> },
  ...FEEDBACK_STORIES.map((story) => ({
    name: `Feedback: ${story.heard}`,
    frames: SCENES.feedback,
    element: <FeedbackStory {...story} />,
  })),
  { name: "Tests", frames: SCENES.testRun, element: <TestRun /> },
  { name: "Stats", frames: SCENES.stats, element: <ProjectStats /> },
  { name: "Ending", frames: SCENES.ending, element: <Ending /> },
];

// Cards wipe into what follows; everything else fades.
const isCard = (scene: Scene) => scene.name.startsWith("Card:");

export const FINAL_DURATION =
  VIDEO.reduce((total, scene) => total + scene.frames, 0) -
  (VIDEO.length - 1) * TRANSITION_FRAMES;

export const FinalVideo: React.FC = () => (
  <TransitionSeries>
    {VIDEO.map((scene, index) => (
      <Fragment key={scene.name}>
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
          name={scene.name}
          durationInFrames={scene.frames}
        >
          {scene.element}
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
  </TransitionSeries>
);
