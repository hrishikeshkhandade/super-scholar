import { describe, expect, it } from "vitest";
import { rideSpeed, type MovingPlatform, type Rider } from "../src/ridePlatform";

const platform: MovingPlatform = { left: 100, right: 196, top: 200, bottom: 212, velocityX: 70 };
const standingOn = (x: number, bottom = 200, velocityY = 0): Rider => ({
  left: x,
  right: x + 20,
  top: bottom - 36,
  bottom,
  velocityY,
});

describe("riding a moving platform", () => {
  it("carries a player standing on it at the platform's speed, with no key held", () => {
    expect(rideSpeed(standingOn(140), [platform])).toBe(70);
    expect(rideSpeed(standingOn(140), [{ ...platform, velocityX: -70 }])).toBe(-70);
  });

  it("still carries a player whose feet gravity pulled a pixel into the platform", () => {
    expect(rideSpeed(standingOn(140, 202), [platform])).toBe(70);
  });

  it("carries a player standing on just the platform's edge", () => {
    expect(rideSpeed(standingOn(85), [platform])).toBe(70);
  });

  it("doesn't carry a player beside, above, or jumping off the platform", () => {
    expect(rideSpeed(standingOn(40), [platform])).toBe(0);
    expect(rideSpeed(standingOn(140, 150), [platform])).toBe(0);
    expect(rideSpeed(standingOn(140, 200, -300), [platform])).toBe(0);
  });

  it("is 0 in a level with no moving platforms", () => {
    expect(rideSpeed(standingOn(140), [])).toBe(0);
  });
});
