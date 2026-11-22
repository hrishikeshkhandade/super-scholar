import { loadFont } from "@remotion/google-fonts/PressStart2P";

// The video uses the game's own look: the NES colors from src/palette.ts and
// the same pixel font, so cards and captions feel like part of Super Scholar.
export const NES = {
  black: "#000000",
  white: "#fcfcfc",
  lightGray: "#bcbcbc",
  gray: "#7c7c7c",
  red: "#f83800",
  yellow: "#f8b800",
  green: "#00a800",
  lime: "#b8f818",
  sky: "#3cbcfc",
  teal: "#00e8d8",
  navy: "#0000bc",
  brown: "#881400",
  tan: "#fca044",
} as const;

export const { fontFamily: PIXEL_FONT } = loadFont("normal", { weights: ["400"], subsets: ["latin"] });

// A hard black outline around pixel text, like the game's title.
export function pixelOutline(size: number): string {
  const offsets = [
    [-size, 0],
    [size, 0],
    [0, -size],
    [0, size],
    [-size, -size],
    [size, size],
    [-size, size],
    [size, -size],
  ];
  return [...offsets.map(([x, y]) => `${x}px ${y}px 0 ${NES.black}`), `0 ${size * 2}px 0 ${NES.black}`].join(", ");
}

// How many characters of `text` show after `frame`, typing `perSecond` a second.
export function typedLength(text: string, frame: number, fps: number, perSecond = 30): number {
  return Math.max(0, Math.min(text.length, Math.floor((frame / fps) * perSecond)));
}
