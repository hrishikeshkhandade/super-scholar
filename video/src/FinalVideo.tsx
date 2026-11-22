import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Fragment } from "react";
import { Intro } from "./scenes/Intro";
import { SectionCard } from "./scenes/SectionCard";
import { Walkthrough, walkthroughFrames } from "./scenes/Walkthrough";
import { BOSS_FIGHT_RUN, REVIEW_NOTEBOOK_RUN, UPLOADED_PAPER_RUN } from "./walkthroughs";

export const FPS = 30;
const TRANSITION_FRAMES = 15;

export const SCENES = {
  intro: 6 * FPS,
  section: 3 * FPS,
  gameplay: 6 * FPS,
  walkthrough: walkthroughFrames(UPLOADED_PAPER_RUN.shots, FPS),
};

type Scene = { name: string; frames: number; element: React.ReactNode };

// The video in order. The full video follows the outline in ../VIDEO.md; each
// part opens with a chapter card, then its recorded gameplay.
const VIDEO: Scene[] = [
  { name: "Intro", frames: SCENES.intro, element: <Intro /> },
  { name: "Card: Playing a level", frames: SCENES.section, element: <SectionCard label="PART 2" title="PLAYING A LEVEL" /> },
  { name: "Walkthrough: uploaded paper", frames: SCENES.walkthrough, element: <Walkthrough {...UPLOADED_PAPER_RUN} /> },
  { name: "Card: The boss", frames: SCENES.section, element: <SectionCard label="PART 3" title="THE BOSS" /> },
  { name: "Walkthrough: boss fight", frames: walkthroughFrames(BOSS_FIGHT_RUN.shots, FPS), element: <Walkthrough {...BOSS_FIGHT_RUN} /> },
  { name: "Card: Review and Notebook", frames: SCENES.section, element: <SectionCard label="PART 4" title="REVIEW & NOTEBOOK" /> },
  {
    name: "Walkthrough: review and notebook",
    frames: walkthroughFrames(REVIEW_NOTEBOOK_RUN.shots, FPS),
    element: <Walkthrough {...REVIEW_NOTEBOOK_RUN} />,
  },
];

// Cards wipe into gameplay; everything else fades.
const isCard = (scene: Scene) => scene.name.startsWith("Card:");

export const FINAL_DURATION = VIDEO.reduce((total, scene) => total + scene.frames, 0) - (VIDEO.length - 1) * TRANSITION_FRAMES;

export const FinalVideo: React.FC = () => (
  <TransitionSeries>
    {VIDEO.map((scene, index) => (
      <Fragment key={scene.name}>
        {index > 0 && isCard(VIDEO[index - 1]) && (
          <TransitionSeries.Transition presentation={wipe({ direction: "from-left" })} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
        )}
        {index > 0 && !isCard(VIDEO[index - 1]) && (
          <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
        )}
        <TransitionSeries.Sequence name={scene.name} durationInFrames={scene.frames}>
          {scene.element}
        </TransitionSeries.Sequence>
      </Fragment>
    ))}
  </TransitionSeries>
);
