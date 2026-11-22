import { NES } from "../theme";

// The game's screen inside the video: 3/4 size, white border, centered near
// the top of the frame, leaving room for the caption bar beneath it.
export const SCREEN = {
  left: 240,
  top: 50,
  width: 1440,
  height: 810,
  border: 6,
} as const;

export const GameScreen: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    style={{
      position: "absolute",
      left: SCREEN.left - SCREEN.border,
      top: SCREEN.top - SCREEN.border,
      width: SCREEN.width,
      height: SCREEN.height,
      border: `${SCREEN.border}px solid ${NES.white}`,
      overflow: "hidden",
      backgroundColor: NES.black,
    }}
  >
    {children}
  </div>
);
