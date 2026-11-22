import { Composition, Folder } from "remotion";
import { FEEDBACK_STORIES } from "./feedbackStories";
import { FINAL_DURATION, FinalVideo, FPS, SCENES } from "./FinalVideo";
import { Ending } from "./scenes/Ending";
import { FeedbackStory } from "./scenes/FeedbackStory";
import { Intro } from "./scenes/Intro";
import { PlanScroll } from "./scenes/PlanScroll";
import { ProjectStats } from "./scenes/ProjectStats";
import { SectionCard } from "./scenes/SectionCard";
import { TestRun } from "./scenes/TestRun";
import { Walkthrough, walkthroughFrames } from "./scenes/Walkthrough";
import { UPLOADED_PAPER_RUN } from "./walkthroughs";

const SIZE = { width: 1920, height: 1080, fps: FPS };

// FinalVideo is the whole video; the Scenes folder has each kind of scene on
// its own, to preview and tweak in Remotion Studio.
export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="FinalVideo"
      component={FinalVideo}
      durationInFrames={FINAL_DURATION}
      {...SIZE}
    />
    <Folder name="Scenes">
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={SCENES.intro}
        {...SIZE}
      />
      <Composition
        id="SectionCard"
        component={SectionCard}
        durationInFrames={SCENES.section}
        defaultProps={{ label: "PART 1", title: "PLAYING A LEVEL" }}
        {...SIZE}
      />
      <Composition
        id="Walkthrough"
        component={Walkthrough}
        durationInFrames={walkthroughFrames(UPLOADED_PAPER_RUN.shots, FPS)}
        defaultProps={UPLOADED_PAPER_RUN}
        {...SIZE}
      />
      <Composition
        id="PlanScroll"
        component={PlanScroll}
        durationInFrames={SCENES.plan}
        {...SIZE}
      />
      <Composition
        id="FeedbackStory"
        component={FeedbackStory}
        durationInFrames={SCENES.feedback}
        defaultProps={FEEDBACK_STORIES[0]}
        {...SIZE}
      />
      <Composition
        id="TestRun"
        component={TestRun}
        durationInFrames={SCENES.testRun}
        {...SIZE}
      />
      <Composition
        id="ProjectStats"
        component={ProjectStats}
        durationInFrames={SCENES.stats}
        {...SIZE}
      />
      <Composition
        id="Ending"
        component={Ending}
        durationInFrames={SCENES.ending}
        {...SIZE}
      />
    </Folder>
  </>
);
