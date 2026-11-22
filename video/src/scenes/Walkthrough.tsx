import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Series, staticFile, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { GameScreen } from "../components/GameScreen";
import { NES } from "../theme";

// One cut of recorded gameplay: seconds `from` to `to` of the clip, played at
// `speed`, with a caption explaining what the viewer is seeing.
export type WalkthroughShot = {
  from: number;
  to: number;
  speed: number;
  caption: string;
};

export type WalkthroughProps = {
  clip: string;
  shots: WalkthroughShot[];
};

// How many video frames a shot lasts once sped up.
export const shotFrames = (shot: WalkthroughShot, fps: number): number => Math.round(((shot.to - shot.from) * fps) / shot.speed);

export const walkthroughFrames = (shots: WalkthroughShot[], fps: number): number =>
  shots.reduce((total, shot) => total + shotFrames(shot, fps), 0);

// Fades the game's sound in and out at each cut so the music doesn't pop.
const FADE_SECONDS = 0.2;

// Recorded gameplay in the game screen, cut into shots, each with its caption.
export const Walkthrough: React.FC<WalkthroughProps> = ({ clip, shots }) => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill name="Walkthrough" style={{ backgroundColor: NES.navy }}>
      <Series>
        {shots.map((shot) => {
          const frames = shotFrames(shot, fps);
          return (
            <Series.Sequence key={`${shot.from}-${shot.to}`} name={shot.caption} durationInFrames={frames}>
              <GameScreen>
                <Video
                  src={staticFile(clip)}
                  trimBefore={Math.round(shot.from * fps)}
                  playbackRate={shot.speed}
                  volume={(f) =>
                    interpolate(f, [0, FADE_SECONDS * fps, frames - FADE_SECONDS * fps, frames], [0, 0.7, 0.7, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })
                  }
                  style={{ width: "100%", height: "100%" }}
                />
              </GameScreen>
              <Caption text={shot.caption} from={0.2 * fps} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
