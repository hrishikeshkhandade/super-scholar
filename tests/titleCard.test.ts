import { describe, expect, it } from "vitest";
import { LIBRARY } from "../src/content/library";
import { layoutFor } from "../src/levels/chooseLayout";

// The level title card reads "WORLD 1-2 / SPREAD CANYON": every level needs
// a short name that fits the card's 24px line (at most 33 characters).
describe("level names for the title card", () => {
  it("gives every level of every built-in world a name that fits", () => {
    for (const paper of LIBRARY) {
      paper.worlds.forEach((world, w) =>
        world.cutscenes.forEach((_, level) => {
          const name = layoutFor(paper.id, w, level).name;
          expect(name.length, `${w + 1}-${level + 1}`).toBeGreaterThan(0);
          expect(name.length, `${w + 1}-${level + 1} ${name}`).toBeLessThanOrEqual(33);
        }),
      );
    }
  });
});
