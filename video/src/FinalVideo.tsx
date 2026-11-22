import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { wipe } from "@remotion/transitions/wipe";
import { Intro } from "./scenes/Intro";
import { SectionCard } from "./scenes/SectionCard";
import { Walkthrough, walkthroughFrames } from "./scenes/Walkthrough";
import { UPLOADED_PAPER_RUN } from "./walkthroughs";

export const FPS = 30;
const TRANSITION_FRAMES = 15;

// Scene lengths in frames. The full video follows the outline in ../VIDEO.md;
// this cut has the opening, one chapter card, and the first recorded play-through.
export const SCENES = {
  intro: 6 * FPS,
  section: 3 * FPS,
  gameplay: 6 * FPS,
  walkthrough: walkthroughFrames(UPLOADED_PAPER_RUN.shots, FPS),
};

export const FINAL_DURATION = SCENES.intro + SCENES.section + SCENES.walkthrough - 2 * TRANSITION_FRAMES;

export const FinalVideo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Intro" durationInFrames={SCENES.intro}>
      <Intro />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })} />
    <TransitionSeries.Sequence name="Section: Playing a level" durationInFrames={SCENES.section}>
      <SectionCard label="PART 2" title="PLAYING A LEVEL" />
    </TransitionSeries.Sequence>
    <TransitionSeries.Transition
      presentation={wipe({ direction: "from-left" })}
      timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
    />
    <TransitionSeries.Sequence name="Walkthrough: uploaded paper" durationInFrames={SCENES.walkthrough}>
      <Walkthrough {...UPLOADED_PAPER_RUN} />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
