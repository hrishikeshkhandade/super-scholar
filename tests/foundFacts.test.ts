import { describe, expect, it } from "vitest";
import { addFoundFact } from "../src/foundFacts";

describe("facts found in a level", () => {
  it("lists facts in the order the bears were stomped", () => {
    expect(addFoundFact(addFoundFact([], 3), 4)).toEqual([3, 4]);
  });

  it("shows a fact only once when the world's facts wrap around", () => {
    let found: number[] = [];
    for (const index of [4, 5, 0, 1, 2, 3, 4]) found = addFoundFact(found, index);
    expect(found).toEqual([4, 5, 0, 1, 2, 3]);
  });

  it("leaves the earlier list unchanged, so a restarted level keeps its own copy", () => {
    const before = [1];
    addFoundFact(before, 2);
    expect(before).toEqual([1]);
  });
});
