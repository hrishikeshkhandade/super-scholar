import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NES, PIXEL_FONT, typedLength } from "../theme";

// Room for the title in the panel: 1680 wide, less 80px padding a side and the 120px cursor.
const TITLE_WIDTH = 1680 - 2 * 80 - 120;

export type SectionCardProps = {
  label: string;
  title: string;
};

// A chapter card between parts of the video, styled like the game's menu box:
// black panel, white border, a blinking ">" cursor while the title types out.
export const SectionCard: React.FC<SectionCardProps> = ({ label, title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const typeStart = 0.5 * fps;
  const shown = typedLength(title, frame - typeStart, fps, 24);
  const cursorOn = Math.floor(frame / (0.4 * fps)) % 2 === 0;
  // Pixel-font letters are square, so a long title shrinks to stay on one line in the panel.
  const titleSize = Math.min(84, Math.floor(TITLE_WIDTH / title.length));

  return (
    <AbsoluteFill
      name="SectionCard"
      style={{
        backgroundColor: NES.navy,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Interactive.Div
        name="Panel"
        style={{
          width: 1680,
          padding: "90px 80px",
          backgroundColor: NES.black,
          border: `10px solid ${NES.white}`,
          scale: interpolate(frame, [0, 0.4 * fps], [0.85, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
            output: "perceptual-scale",
          }),
          opacity: interpolate(frame, [0, 0.25 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div style={{ fontFamily: PIXEL_FONT, fontSize: 36, color: NES.gray }}>
          {label}
        </div>
        <div
          style={{
            marginTop: 48,
            display: "flex",
            alignItems: "center",
            whiteSpace: "nowrap",
            fontFamily: PIXEL_FONT,
            fontSize: titleSize,
            color: NES.yellow,
          }}
        >
          <span
            style={{ width: 120, visibility: cursorOn ? "visible" : "hidden" }}
          >
            &gt;
          </span>
          <span>{title.slice(0, shown)}</span>
        </div>
      </Interactive.Div>
    </AbsoluteFill>
  );
};
