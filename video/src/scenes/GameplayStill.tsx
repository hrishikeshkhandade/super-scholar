import { AbsoluteFill, Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Caption } from "../components/Caption";
import { GameScreen } from "../components/GameScreen";
import { NES } from "../theme";

export type GameplayStillProps = {
  image: string;
  caption: string;
};

// A game screenshot in the game screen (crisp pixels, slow push-in) with a
// caption, for moments no recorded clip covers.
export const GameplayStill: React.FC<GameplayStillProps> = ({ image, caption }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  return (
    <AbsoluteFill name="GameplayStill" style={{ backgroundColor: NES.navy }}>
      <GameScreen>
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
      </GameScreen>
      <Caption text={caption} from={0.6 * fps} />
    </AbsoluteFill>
  );
};
