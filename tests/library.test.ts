import { describe, expect, it } from "vitest";
import { LIBRARY, findPaper, searchPapers } from "../src/content/library";

describe("paper search", () => {
  it("shows every paper for an empty search", () => {
    expect(searchPapers("")).toHaveLength(LIBRARY.length);
    expect(searchPapers("   ")).toHaveLength(LIBRARY.length);
  });

  it("finds the stat arb paper by author, title words, or year, ignoring case", () => {
    for (const query of ["avellaneda", "STATISTICAL arbitrage", "2008", "lee equities"]) {
      expect(searchPapers(query).map((paper) => paper.id)).toContain("avellaneda-lee-2008");
    }
  });

  it("returns nothing when no paper matches", () => {
    expect(searchPapers("photosynthesis")).toEqual([]);
  });

  it("looks papers up by id", () => {
    expect(findPaper("avellaneda-lee-2008")?.year).toBe(2008);
    expect(findPaper("missing")).toBeUndefined();
  });
});
