import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { NES } from "../theme";

export type GameplayStillProps = {
  image: string;
  caption: string;
};

// The gameplay frame: the game at 3/4 size in a white-bordered screen on the
// navy backdrop, with the caption bar underneath. Until the OBS clips exist it
// shows a game screenshot (crisp pixels, slow push-in) in the screen.
export const GameplayStill: React.FC<GameplayStillProps> = ({ image, caption }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill name="GameplayStill" style={{ backgroundColor: NES.navy }}>
      <div
        style={{
          position: "absolute",
          left: 240,
          top: 50,
          width: 1440,
          height: 810,
          boxSizing: "content-box",
          border: `6px solid ${NES.white}`,
          marginLeft: -6,
          marginTop: -6,
          overflow: "hidden",
          backgroundColor: NES.black,
        }}
      >
        <Img
          src={staticFile(image)}
          style={{
            width: "100%",
            height: "100%",
            imageRendering: "pixelated",
            scale: interpolate(frame, [0, durationInFrames], [1, 1.05], {
              easing: Easing.bezier(0.33, 0, 0.67, 1),
              output: "perceptual-scale",
            }),
          }}
        />
      </div>
      <Caption text={caption} from={0.6 * fps} />
    </AbsoluteFill>
  );
};
