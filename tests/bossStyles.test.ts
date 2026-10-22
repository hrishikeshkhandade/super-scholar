import { describe, expect, it } from "vitest";
import { BOSS_STYLES, BOSS_STYLE_NAMES, bossStyleFor } from "../src/bossStyles";

describe("boss styles", () => {
  it("keeps World 1's boss as the charger, then gives each world the next style", () => {
    expect([0, 1, 2].map(bossStyleFor)).toEqual(["charger", "jumper", "thrower"]);
  });

  it("starts the order over for papers with more worlds than styles", () => {
    expect(bossStyleFor(BOSS_STYLES.length)).toBe("charger");
    expect(bossStyleFor(BOSS_STYLES.length + 1)).toBe("jumper");
  });

  it("names every style for the boss title card", () => {
    for (const style of BOSS_STYLES) expect(BOSS_STYLE_NAMES[style]).toMatch(/^THE [A-Z]+$/);
  });
});
