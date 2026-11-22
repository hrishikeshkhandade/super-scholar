import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Panel } from "../components/Panel";
import projectData from "../projectData.json";
import { NES, PIXEL_FONT, shortDate } from "../theme";

const LINE_HEIGHT = 56;
const PANEL = { left: 120, top: 150, width: 1680, height: 860 };
const VISIBLE_HEIGHT = PANEL.height - 2 * 6 - 2 * 40;

// PLAN.md's Done list scrolling past, oldest first, with a counter of
// features finished: the project's real history, one dated line each.
export const PlanScroll: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const { features } = projectData;
  const scrollDistance = features.length * LINE_HEIGHT - VISIBLE_HEIGHT;
  const scrollStart = 0.8 * fps;
  const scrollEnd = durationInFrames - 0.8 * fps;
  const scrolled = interpolate(
    frame,
    [scrollStart, scrollEnd],
    [0, scrollDistance],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );
  // The count follows the line at the bottom of the panel.
  const counted = Math.min(
    features.length,
    Math.floor((scrolled + VISIBLE_HEIGHT) / LINE_HEIGHT),
  );

  return (
    <AbsoluteFill name="PlanScroll" style={{ backgroundColor: NES.navy }}>
      <div
        style={{
          position: "absolute",
          left: PANEL.left,
          right: PANEL.left,
          top: 56,
          display: "flex",
          justifyContent: "space-between",
          fontFamily: PIXEL_FONT,
          fontSize: 40,
          color: NES.white,
        }}
      >
        <span>PLAN.md</span>
        <span style={{ color: NES.yellow }}>{counted} FEATURES DONE</span>
      </div>
      <Panel label="DONE" style={PANEL}>
        <div style={{ position: "absolute", inset: 40, overflow: "hidden" }}>
          <div style={{ translate: `0px ${-scrolled}px` }}>
            {features.map((feature, index) => (
              <div
                key={`${feature.date}-${index}`}
                style={{
                  height: LINE_HEIGHT,
                  display: "flex",
                  fontFamily: PIXEL_FONT,
                  fontSize: 24,
                  lineHeight: `${LINE_HEIGHT}px`,
                  whiteSpace: "nowrap",
                }}
              >
                <span style={{ width: 240, flexShrink: 0, color: NES.gray }}>
                  {shortDate(feature.date)}
                </span>
                <span
                  style={{
                    color: NES.white,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {feature.title}
                </span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
    </AbsoluteFill>
  );
};
