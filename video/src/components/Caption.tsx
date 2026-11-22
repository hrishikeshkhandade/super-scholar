import { Easing, Interactive, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { NES, PIXEL_FONT, typedLength } from "../theme";

export type CaptionProps = {
  text: string;
  // Frame (inside the parent sequence) when the caption slides in.
  from?: number;
};

// The caption bar under the framed gameplay, like the game's text boxes: it
// slides up and types its text. It sits below the game, never on top of it.
export const Caption: React.FC<CaptionProps> = ({ text, from = 0 }) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name="Caption"
      style={{
        position: "absolute",
        // Lines up with the gameplay screen's outer border edge above it.
        left: 234,
        right: 234,
        top: 896,
        height: 150,
        boxSizing: "border-box",
        padding: "22px 36px",
        display: "flex",
        alignItems: "center",
        backgroundColor: NES.black,
        border: `6px solid ${NES.white}`,
        fontFamily: PIXEL_FONT,
        fontSize: 32,
        lineHeight: 1.6,
        color: NES.white,
        opacity: interpolate(frame, [0, 0.2 * fps], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        translate: interpolate(frame, [0, 0.45 * fps], ["0px 60px", "0px 0px"], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.spring({ damping: 200 }),
        }),
      }}
    >
      {text.slice(0, typedLength(text, frame - 0.3 * fps, fps, 40))}
    </Interactive.Div>
  );
};
