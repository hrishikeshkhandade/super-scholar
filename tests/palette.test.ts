import { describe, expect, it } from "vitest";
import { THEMES } from "../src/levels/themes";
import { NES_HARDWARE_PALETTE } from "../src/nesPalette";
import { NES } from "../src/palette";

const isNes = (color: number) => NES_HARDWARE_PALETTE.includes(color);
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

describe("colors", () => {
  it("uses only real NES colors for the game's base palette", () => {
    for (const [name, color] of Object.entries(NES)) expect(isNes(color), `${name} ${hex(color)}`).toBe(true);
  });

  it("uses only real NES colors in every level theme", () => {
    for (const theme of THEMES) {
      const colors = [...theme.sky, ...theme.farColors, theme.farAccent, ...theme.hills, ...theme.grass, theme.dirt, theme.speck];
      for (const color of colors) expect(isNes(color), `${theme.name} ${hex(color)}`).toBe(true);
    }
  });
});
