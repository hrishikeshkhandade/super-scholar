import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Ground } from "../components/Ground";
import { PixelCloud } from "../components/PixelCloud";
import { NES, PIXEL_FONT, pixelOutline } from "../theme";

const LINK = "super-scholar.super-scholar.workers.dev";

// The closing card, back on the title screen's sky: where to play, and who made it.
export const Ending: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const appear = (at: number) => ({
    opacity: interpolate(frame, [at * fps, (at + 0.4) * fps], [0, 1], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
    translate: interpolate(
      frame,
      [at * fps, (at + 0.5) * fps],
      ["0px 30px", "0px 0px"],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        easing: Easing.bezier(0.16, 1, 0.3, 1),
      },
    ),
  });

  return (
    <AbsoluteFill
      name="Ending"
      style={{ background: `linear-gradient(${NES.sky} 0%, ${NES.teal} 100%)` }}
    >
      <Interactive.Div
        name="Clouds"
        style={{
          position: "absolute",
          inset: 0,
          translate: interpolate(
            frame,
            [0, 10 * fps],
            ["0px 0px", "-160px 0px"],
          ),
        }}
      >
        <PixelCloud x={200} y={110} />
        <PixelCloud x={1450} y={160} unit={12} />
      </Interactive.Div>

      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          paddingBottom: 60,
        }}
      >
        <Interactive.Div
          name="Heading"
          style={{
            fontFamily: PIXEL_FONT,
            fontSize: 100,
            color: NES.yellow,
            textShadow: pixelOutline(7),
            ...appear(0.2),
          }}
        >
          PLAY IT YOURSELF
        </Interactive.Div>
        <Interactive.Div
          name="Link"
          style={{
            marginTop: 80,
            padding: "36px 48px",
            backgroundColor: NES.black,
            border: `8px solid ${NES.white}`,
            fontFamily: PIXEL_FONT,
            fontSize: 36,
            color: NES.white,
            ...appear(0.7),
          }}
        >
          {LINK}
        </Interactive.Div>
        <Interactive.Div
          name="Byline"
          style={{
            marginTop: 70,
            fontFamily: PIXEL_FONT,
            fontSize: 30,
            color: NES.black,
            ...appear(1.3),
          }}
        >
          MADE BY HRISHIKESH KHANDADE · CS 124 · FALL 2026
        </Interactive.Div>
      </AbsoluteFill>

      <Ground />
    </AbsoluteFill>
  );
};
