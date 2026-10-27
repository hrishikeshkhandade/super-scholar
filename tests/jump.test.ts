import { describe, expect, it } from "vitest";
import { jumpHeight } from "../src/jump";
import { TILE } from "../src/levels/parseLevel";

describe("the player's jump", () => {
  it("matches what the game measured for the old jump", () => {
    // In the running game a -600 jump rose 123.6 px.
    expect(jumpHeight(-600)).toBeCloseTo(123.6, 1);
  });

  it("clears blocks and platforms 4 tiles up, like sky blocks and the boss arena's platforms", () => {
    expect(jumpHeight()).toBeGreaterThanOrEqual(4 * TILE + 16);
  });

  it("stays under 5 tiles, so walls and ledges still need the steps the levels were built with", () => {
    expect(jumpHeight()).toBeLessThan(5 * TILE);
  });
});
