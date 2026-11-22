import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Panel } from "../components/Panel";
import projectData from "../projectData.json";
import { MONO_FONT, NES, typedLength } from "../theme";

const LINE_HEIGHT = 40;
const PANEL = { left: 120, top: 120, width: 1680, height: 880 };
const VISIBLE_LINES = Math.floor((PANEL.height - 2 * 6 - 2 * 44) / LINE_HEIGHT);
const GREEN = "#58d854";

type Line = { at: number; text: string; color: string; typed?: boolean };

// The project's checks, replayed as a terminal: the unit tests, then every
// play-through of the real game by name, each with its green tick. The names
// and counts come from the project (npm run data), not from this file.
export const TestRun: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { unitTests, playThroughs } = projectData;

  const lines: Line[] = [
    { at: 0.3, text: "$ npm test", color: NES.white, typed: true },
    {
      at: 1.1,
      text: ` ✓ ${unitTests.files} test files   ${unitTests.passed} tests passed`,
      color: GREEN,
    },
    { at: 1.8, text: "$ npm run check:game", color: NES.white, typed: true },
    ...playThroughs.map((name, index) => ({
      at: 2.7 + index * 0.28,
      text: ` ✓ ${name}`,
      color: GREEN,
    })),
  ];
  lines.push({
    at: lines[lines.length - 1].at + 0.5,
    text: ` ${playThroughs.length} play-throughs passed`,
    color: NES.yellow,
  });

  const shown = lines.filter((line) => frame >= line.at * fps);
  // Keep the newest lines in view, like a terminal scrolling.
  const firstVisible = Math.max(0, shown.length - VISIBLE_LINES);

  return (
    <AbsoluteFill name="TestRun" style={{ backgroundColor: NES.navy }}>
      <Panel label="EVERY CHANGE IS CHECKED" style={PANEL}>
        <div
          style={{
            position: "absolute",
            inset: 44,
            overflow: "hidden",
            fontFamily: MONO_FONT,
            fontSize: 26,
          }}
        >
          {shown.slice(firstVisible).map((line) => {
            const text = line.typed
              ? line.text.slice(
                  0,
                  typedLength(line.text, frame - line.at * fps, fps, 24),
                )
              : line.text;
            return (
              <div
                key={`${line.at}-${line.text}`}
                style={{
                  height: LINE_HEIGHT,
                  lineHeight: `${LINE_HEIGHT}px`,
                  whiteSpace: "nowrap",
                  color: line.color,
                  fontWeight: line.typed ? 700 : 400,
                  opacity: interpolate(
                    frame,
                    [line.at * fps, line.at * fps + 3],
                    [0, 1],
                    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
                  ),
                }}
              >
                {text}
              </div>
            );
          })}
        </div>
      </Panel>
    </AbsoluteFill>
  );
};

// How long the terminal needs to show every line, plus a beat to read the total.
export const testRunSeconds = (): number =>
  2.7 + projectData.playThroughs.length * 0.28 + 0.5 + 1.8;
