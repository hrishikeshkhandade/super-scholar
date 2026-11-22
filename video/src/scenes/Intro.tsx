import { AbsoluteFill, Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Ground } from "../components/Ground";
import { PixelCloud } from "../components/PixelCloud";
import { NES, PIXEL_FONT, pixelOutline, typedLength } from "../theme";

const TITLE = "SUPER SCHOLAR";
const TAGLINE = "Research papers, but make it a game";
const BYLINE = "A CS 124 PROJECT BY HRISHIKESH KHANDADE";

// Opening card: the title drops in letter by letter like blocks, then the
// tagline and byline type out the way the game's dialog does.
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const lettersDone = TITLE.length * 3 + 0.8 * fps;
  const taglineStart = lettersDone;
  const bylineStart = taglineStart + 1.4 * fps;

  return (
    <AbsoluteFill name="Intro" style={{ background: `linear-gradient(${NES.sky} 0%, ${NES.teal} 100%)` }}>
      <Interactive.Div
        name="Clouds"
        style={{
          position: "absolute",
          inset: 0,
          translate: interpolate(frame, [0, 8 * fps], ["0px 0px", "-160px 0px"]),
        }}
      >
        <PixelCloud x={180} y={120} />
        <PixelCloud x={1420} y={90} unit={12} />
        <PixelCloud x={620} y={190} unit={10} />
      </Interactive.Div>

      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", paddingBottom: 60 }}>
        <div style={{ display: "flex", fontFamily: PIXEL_FONT, fontSize: 124, color: NES.yellow }}>
          {TITLE.split("").map((letter, index) => (
            <Interactive.Div
              key={index}
              name={`Letter ${index + 1}`}
              style={{
                width: letter === " " ? 70 : undefined,
                textShadow: pixelOutline(8),
                translate: interpolate(frame, [index * 3, index * 3 + 0.7 * fps], ["0px -700px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: Easing.spring({ damping: 12 }),
                }),
              }}
            >
              {letter}
            </Interactive.Div>
          ))}
        </div>

        <Interactive.Div
          name="Tagline"
          style={{
            marginTop: 70,
            minHeight: 44,
            fontFamily: PIXEL_FONT,
            fontSize: 44,
            color: NES.white,
            textShadow: pixelOutline(4),
          }}
        >
          {TAGLINE.slice(0, typedLength(TAGLINE, frame - taglineStart, fps))}
        </Interactive.Div>

        <Interactive.Div
          name="Byline"
          style={{
            marginTop: 56,
            fontFamily: PIXEL_FONT,
            fontSize: 26,
            color: NES.black,
            opacity: interpolate(frame, [bylineStart, bylineStart + 0.5 * fps], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            }),
          }}
        >
          {BYLINE}
        </Interactive.Div>
      </AbsoluteFill>

      <Ground />
    </AbsoluteFill>
  );
};
