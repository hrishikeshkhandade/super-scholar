import {
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { NES, PIXEL_FONT } from "../theme";

type PanelProps = {
  label: string;
  style: React.CSSProperties;
  // Frame the panel pops in at.
  from?: number;
  children: React.ReactNode;
};

// A black box with a white border and a small gray label on its top edge,
// like the game's menu boxes and Prof. Quant's name tag.
export const Panel: React.FC<PanelProps> = ({
  label,
  style,
  from = 0,
  children,
}) => {
  const frame = useCurrentFrame() - from;
  const { fps } = useVideoConfig();

  return (
    <Interactive.Div
      name={label}
      style={{
        position: "absolute",
        boxSizing: "border-box",
        backgroundColor: NES.black,
        border: `6px solid ${NES.white}`,
        opacity: interpolate(frame, [0, 0.2 * fps], [0, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        }),
        scale: interpolate(frame, [0, 0.35 * fps], [0.92, 1], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
          easing: Easing.bezier(0.16, 1, 0.3, 1),
          output: "perceptual-scale",
        }),
        ...style,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -20,
          left: 32,
          padding: "0 14px",
          backgroundColor: NES.black,
          fontFamily: PIXEL_FONT,
          fontSize: 28,
          lineHeight: "34px",
          color: NES.sky,
        }}
      >
        {label}
      </div>
      {children}
    </Interactive.Div>
  );
};
