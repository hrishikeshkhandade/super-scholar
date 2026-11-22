import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Panel } from "../components/Panel";
import { NES, PIXEL_FONT, typedLength } from "../theme";

export type FeedbackStoryProps = {
  // What a classmate told the student, paraphrased from PLAN.md (not a quote).
  heard: string;
  // What changed in the game because of it.
  fix: string;
  // A screenshot of the fix, from the play-through checks.
  image: string;
  // Seconds in when the fix (and the arrow just before it) appears.
  fixAt?: number;
};

const TEXT: React.CSSProperties = {
  position: "absolute",
  left: 40,
  right: 40,
  top: 56,
  fontFamily: PIXEL_FONT,
  fontSize: 32,
  lineHeight: 1.7,
};

// One piece of classmate feedback and the change it led to: what they said on
// the left, an arrow, and the game as it is now on the right.
export const FeedbackStory: React.FC<FeedbackStoryProps> = ({
  heard,
  fix,
  image,
  fixAt = 1.6,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fixFrom = fixAt * fps;
  const arrowFrom = fixFrom - 0.5 * fps;

  return (
    <AbsoluteFill name="FeedbackStory" style={{ backgroundColor: NES.navy }}>
      <Panel
        label="A CLASSMATE SAID"
        style={{ left: 120, top: 120, width: 640, height: 400 }}
      >
        <div style={{ ...TEXT, color: NES.yellow }}>
          {heard.slice(0, typedLength(heard, frame - 0.3 * fps, fps, 45))}
        </div>
      </Panel>

      <Interactive.Div
        name="Arrow"
        style={{
          position: "absolute",
          left: 790,
          top: 270,
          fontFamily: PIXEL_FONT,
          fontSize: 80,
          color: NES.white,
          opacity: interpolate(
            frame,
            [arrowFrom, arrowFrom + 0.3 * fps],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            },
          ),
          translate: interpolate(
            frame,
            [arrowFrom, arrowFrom + 0.4 * fps],
            ["-30px 0px", "0px 0px"],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          ),
        }}
      >
        &gt;
      </Interactive.Div>

      <Panel
        label="SO NOW"
        from={fixFrom}
        style={{ left: 120, top: 600, width: 640, height: 400 }}
      >
        <div style={{ ...TEXT, color: NES.white }}>
          {fix.slice(0, typedLength(fix, frame - fixFrom - 0.3 * fps, fps, 45))}
        </div>
      </Panel>

      <Panel
        label="IN THE GAME"
        from={fixFrom}
        style={{ left: 900, top: 120, width: 900, height: 880 }}
      >
        <div
          style={{
            position: "absolute",
            left: 18,
            right: 18,
            top: 40,
            bottom: 18,
            display: "flex",
            alignItems: "center",
          }}
        >
          <Img
            src={staticFile(image)}
            style={{ width: "100%", imageRendering: "pixelated" }}
          />
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
