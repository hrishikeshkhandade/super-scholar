import { AbsoluteFill } from "remotion";
import { NES } from "../theme";

// The grass-and-dirt strip from the bottom of the game's title screen.
export const Ground: React.FC<{ height?: number }> = ({ height = 150 }) => (
  <AbsoluteFill style={{ top: "auto", height }}>
    <div style={{ height: 10, backgroundColor: NES.lime }} />
    <div style={{ height: 22, backgroundColor: NES.green }} />
    <div
      style={{
        flex: 1,
        backgroundColor: NES.brown,
        backgroundImage: `radial-gradient(${NES.tan} 3px, transparent 3px)`,
        backgroundSize: "36px 28px",
      }}
    />
  </AbsoluteFill>
);
