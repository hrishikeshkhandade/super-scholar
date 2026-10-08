// Background and ground colors for levels. Every color is from the NES
// hardware palette, so the game keeps its retro look while each level feels
// different.

export type FarScenery = "city" | "mountains" | "mesas";

export interface Theme {
  name: string;
  sky: [number, number, number]; // horizontal bands, top to bottom
  far: FarScenery;
  farColors: [number, number]; // buildings or mountains
  farAccent: number; // lit windows, or snowcaps
  hills: [number, number]; // dark, light
  grass: [number, number]; // top edge, under it
  dirt: number;
  speck: number;
  cloudAlpha: number;
  stars: boolean;
}

export const THEMES: Theme[] = [
  {
    name: "meadow",
    sky: [0x6888fc, 0x3cbcfc, 0xa4e4fc],
    far: "city",
    farColors: [0x0058f8, 0x6844fc],
    farAccent: 0xf8b800,
    hills: [0x00a800, 0xb8f818],
    grass: [0xb8f818, 0x00a800],
    dirt: 0x881400,
    speck: 0xfca044,
    cloudAlpha: 1,
    stars: false,
  },
  {
    name: "sunset",
    sky: [0xe45c10, 0xf87858, 0xfca044],
    far: "mountains",
    farColors: [0x881400, 0xa81000],
    farAccent: 0xf8d878,
    hills: [0x503000, 0xac7c00],
    grass: [0xf8b800, 0xac7c00],
    dirt: 0x503000,
    speck: 0xe45c10,
    cloudAlpha: 0.8,
    stars: false,
  },
  {
    name: "neon",
    sky: [0x000000, 0x0000bc, 0x4428bc],
    far: "city",
    farColors: [0x940084, 0x4428bc],
    farAccent: 0x00e8d8,
    hills: [0x004058, 0x008888],
    grass: [0x00e8d8, 0x008888],
    dirt: 0x004058,
    speck: 0x0078f8,
    cloudAlpha: 0.15,
    stars: true,
  },
  {
    name: "desert",
    sky: [0xf8d878, 0xfce0a8, 0xf0d0b0],
    far: "mesas",
    farColors: [0xe45c10, 0xac7c00],
    farAccent: 0xf8b800,
    hills: [0xfca044, 0xf8b800],
    grass: [0xf8d878, 0xfca044],
    dirt: 0xac7c00,
    speck: 0xe45c10,
    cloudAlpha: 0.6,
    stars: false,
  },
  {
    name: "snow",
    sky: [0x6888fc, 0xa4e4fc, 0xfcfcfc],
    far: "mountains",
    farColors: [0x7c7c7c, 0xbcbcbc],
    farAccent: 0xfcfcfc,
    hills: [0xbcbcbc, 0xfcfcfc],
    grass: [0xfcfcfc, 0xa4e4fc],
    dirt: 0x7c7c7c,
    speck: 0xbcbcbc,
    cloudAlpha: 0.9,
    stars: false,
  },
  {
    name: "candy",
    sky: [0xd800cc, 0xf878f8, 0xf8b8f8],
    far: "city",
    farColors: [0x6844fc, 0x940084],
    farAccent: 0xfce0a8,
    hills: [0xe40058, 0xf85898],
    grass: [0xf8b8f8, 0xf878f8],
    dirt: 0x940084,
    speck: 0xf8a4c0,
    cloudAlpha: 0.9,
    stars: false,
  },
  {
    name: "forest",
    sky: [0x008888, 0x00e8d8, 0xb8f8d8],
    far: "mountains",
    farColors: [0x005800, 0x007800],
    farAccent: 0x58d854,
    hills: [0x006800, 0x00b800],
    grass: [0x58d854, 0x00a844],
    dirt: 0x503000,
    speck: 0xac7c00,
    cloudAlpha: 0.7,
    stars: false,
  },
  {
    name: "midnight",
    sky: [0x000000, 0x4428bc, 0x6844fc],
    far: "mountains",
    farColors: [0x0000bc, 0x4428bc],
    farAccent: 0xb8b8f8,
    hills: [0x0000bc, 0x6888fc],
    grass: [0xb8b8f8, 0x6888fc],
    dirt: 0x4428bc,
    speck: 0x9878f8,
    cloudAlpha: 0.2,
    stars: true,
  },
];

// Each level gets the next theme in turn, so neighbouring levels always
// look different, and each paper starts at its own point in the cycle.
export function themeFor(paperSeed: number, worldIndex: number, levelIndex: number): Theme {
  return THEMES[(paperSeed + worldIndex * 3 + levelIndex) % THEMES.length];
}
