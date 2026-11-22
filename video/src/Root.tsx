import { Composition, Folder } from "remotion";
import { FINAL_DURATION, FinalVideo, FPS, SCENES } from "./FinalVideo";
import { GameplayStill } from "./scenes/GameplayStill";
import { Intro } from "./scenes/Intro";
import { SectionCard } from "./scenes/SectionCard";
import { Walkthrough } from "./scenes/Walkthrough";
import { UPLOADED_PAPER_RUN } from "./walkthroughs";

const SIZE = { width: 1920, height: 1080, fps: FPS };

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="FinalVideo" component={FinalVideo} durationInFrames={FINAL_DURATION} {...SIZE} />
    <Folder name="Scenes">
      <Composition id="Intro" component={Intro} durationInFrames={SCENES.intro} {...SIZE} />
      <Composition
        id="SectionCard"
        component={SectionCard}
        durationInFrames={SCENES.section}
        defaultProps={{ label: "PART 2", title: "PLAYING A LEVEL" }}
        {...SIZE}
      />
      <Composition
        id="GameplayStill"
        component={GameplayStill}
        durationInFrames={SCENES.gameplay}
        defaultProps={{
          image: "stills/2-level-clear-with-facts.png",
          caption: "Bears hold fun facts from the paper. Stomp one and a fact appears.",
        }}
        {...SIZE}
      />
      <Composition
        id="Walkthrough"
        component={Walkthrough}
        durationInFrames={SCENES.walkthrough}
        defaultProps={UPLOADED_PAPER_RUN}
        {...SIZE}
      />
    </Folder>
  </>
);
