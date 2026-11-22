import { NES } from "../theme";

// A blocky cloud built from three stacked rectangles, `unit` pixels per block.
export const PixelCloud: React.FC<{ x: number; y: number; unit?: number }> = ({ x, y, unit = 14 }) => (
  <div style={{ position: "absolute", left: x, top: y }}>
    <div style={{ marginLeft: unit * 3, width: unit * 4, height: unit, backgroundColor: NES.white }} />
    <div style={{ marginLeft: unit, width: unit * 8, height: unit, backgroundColor: NES.white }} />
    <div style={{ width: unit * 10, height: unit, backgroundColor: NES.white }} />
  </div>
);
