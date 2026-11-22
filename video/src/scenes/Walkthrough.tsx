import { Video } from "@remotion/media";
import { AbsoluteFill, interpolate, Series, staticFile, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { GameScreen } from "../components/GameScreen";
import { NES } from "../theme";

// One cut of recorded gameplay: seconds `from` to `to` of the clip, played at
// `speed`, with a caption explaining what the viewer is seeing. Back-to-back
// shots with the same caption read as one shot: the caption stays put.
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

const VOLUME = 0.7;
// Fades the game's sound in and out where the caption changes, so the music doesn't pop.
const FADE_SECONDS = 0.2;
// Below this speed the game's sound turns into a growl, so slow-motion shots are silent.
const SLOWEST_AUDIBLE_SPEED = 0.5;

// Recorded gameplay in the game screen, cut into shots, each with its caption.
export const Walkthrough: React.FC<WalkthroughProps> = ({ clip, shots }) => {
  const { fps } = useVideoConfig();
  const fade = FADE_SECONDS * fps;

  return (
    <AbsoluteFill name="Walkthrough" style={{ backgroundColor: NES.navy }}>
      <Series>
        {shots.map((shot, index) => {
          const frames = shotFrames(shot, fps);
          const continues = index > 0 && shots[index - 1].caption === shot.caption;
          const continuesInto = index < shots.length - 1 && shots[index + 1].caption === shot.caption;
          const volumeIn = continues ? VOLUME : 0;
          const volumeOut = continuesInto ? VOLUME : 0;
          return (
            <Series.Sequence key={`${shot.from}-${shot.to}`} name={shot.caption} durationInFrames={frames}>
              <GameScreen>
                <Video
                  src={staticFile(clip)}
                  trimBefore={Math.round(shot.from * fps)}
                  playbackRate={shot.speed}
                  muted={shot.speed < SLOWEST_AUDIBLE_SPEED}
                  volume={(f) =>
                    interpolate(f, [0, fade, frames - fade, frames], [volumeIn, VOLUME, VOLUME, volumeOut], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })
                  }
                  style={{ width: "100%", height: "100%" }}
                />
              </GameScreen>
              {/* A continuing caption starts long finished, so it doesn't slide or retype. */}
              <Caption text={shot.caption} from={continues ? -10 * fps : 0.2 * fps} />
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
