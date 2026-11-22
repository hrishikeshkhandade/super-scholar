import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { Intro } from "./scenes/Intro";
import { GameplayStill } from "./scenes/GameplayStill";
import { SectionCard } from "./scenes/SectionCard";

export const FPS = 30;
const TRANSITION_FRAMES = 15;

// Scene lengths in frames. The full video follows the outline in ../VIDEO.md;
// this first cut has the opening and one section to set the look.
export const SCENES = {
  intro: 6 * FPS,
  section: 3 * FPS,
  gameplay: 6 * FPS,
};

export const FINAL_DURATION = SCENES.intro + SCENES.section + SCENES.gameplay - 2 * TRANSITION_FRAMES;

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
      presentation={slide({ direction: "from-right" })}
      timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
    />
    <TransitionSeries.Sequence name="Gameplay: Level clear" durationInFrames={SCENES.gameplay}>
      <GameplayStill
        image="stills/2-level-clear-with-facts.png"
        caption="Bears hold fun facts from the paper. Stomp one and a fact appears."
      />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
