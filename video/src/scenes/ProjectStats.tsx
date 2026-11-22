import {
  AbsoluteFill,
  Easing,
  Interactive,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import projectData from "../projectData.json";
import { NES, PIXEL_FONT, pixelOutline, shortDate } from "../theme";

// The project by the numbers, each counting up like a game's score.
export const ProjectStats: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const stats = [
    { value: projectData.features.length, label: "FEATURES" },
    { value: projectData.commits, label: "COMMITS" },
    { value: projectData.unitTests.passed, label: "TESTS" },
    { value: projectData.playThroughs.length, label: "PLAY-THROUGHS" },
  ];

  return (
    <AbsoluteFill
      name="ProjectStats"
      style={{
        backgroundColor: NES.navy,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div style={{ display: "flex", gap: 40 }}>
        {stats.map((stat, index) => {
          const start = 0.2 * fps + index * 0.25 * fps;
          const progress = interpolate(
            frame,
            [start, start + 1.2 * fps],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.bezier(0.16, 1, 0.3, 1),
            },
          );
          return (
            <Interactive.Div
              key={stat.label}
              name={stat.label}
              style={{
                width: 390,
                height: 300,
                boxSizing: "border-box",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 40,
                backgroundColor: NES.black,
                border: `6px solid ${NES.white}`,
                opacity: interpolate(
                  frame,
                  [start, start + 0.2 * fps],
                  [0, 1],
                  { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                ),
              }}
            >
              <div
                style={{
                  fontFamily: PIXEL_FONT,
                  fontSize: 96,
                  color: NES.yellow,
                  textShadow: pixelOutline(5),
                }}
              >
                {Math.round(stat.value * progress)}
              </div>
              <div
                style={{
                  fontFamily: PIXEL_FONT,
                  fontSize: 24,
                  color: NES.white,
                }}
              >
                {stat.label}
              </div>
            </Interactive.Div>
          );
        })}
      </div>
      <Interactive.Div
        name="Since"
        style={{
          marginTop: 80,
          fontFamily: PIXEL_FONT,
          fontSize: 40,
          color: NES.white,
          opacity: interpolate(frame, [1.6 * fps, 2 * fps], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        SINCE {shortDate(projectData.firstCommit).toUpperCase()}
      </Interactive.Div>
    </AbsoluteFill>
  );
};
