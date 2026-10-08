// Colors from the NES hardware palette (see nesPalette.ts; a test checks them).
export const NES = {
  black: 0x000000,
  white: 0xfcfcfc,
  lightGray: 0xbcbcbc,
  gray: 0x7c7c7c,
  red: 0xf83800,
  salmon: 0xf87858,
  yellow: 0xf8b800,
  green: 0x00a800,
  lime: 0xb8f818,
  blue: 0x0058f8,
  sky: 0x3cbcfc,
  navy: 0x0000bc,
  purple: 0x6844fc,
  brown: 0x881400,
  tan: 0xfca044,
} as const;

export function css(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

export const FONT = '"Press Start 2P", monospace';
