import { describe, expect, it } from "vitest";
import { abstractFromIndex, parseResults, searchUrl } from "../src/content/openAlex";

describe("OpenAlex search", () => {
  it("builds an HTTPS search URL that only asks for papers with abstracts", () => {
    const url = new URL(searchUrl("  black holes "));
    expect(url.protocol).toBe("https:");
    expect(url.searchParams.get("search")).toBe("black holes");
    expect(url.searchParams.get("filter")).toBe("has_abstract:true");
  });

  it("rebuilds abstracts from OpenAlex's word-position index", () => {
    expect(abstractFromIndex({ pairs: [1], Trading: [0], works: [2] })).toBe("Trading pairs works");
    expect(abstractFromIndex(null)).toBe("");
  });

  it("turns raw results into papers, with the best PDF link upgraded to https", () => {
    const papers = parseResults({
      results: [
        {
          id: "https://openalex.org/W1",
          display_name: "Sink regulation of photosynthesis",
          publication_year: 2001,
          authorships: [{ author: { display_name: "Matthew Paul" } }, { author: {} }],
          primary_topic: { field: { display_name: "Agricultural and Biological Sciences" } },
          best_oa_location: { pdf_url: "https://example.org/paper.pdf" },
          abstract_inverted_index: { Plants: [0], grow: [1] },
        },
        { id: "https://openalex.org/W2", display_name: "Archive copy", locations: [{ pdf_url: "http://uni.edu/a.pdf" }] },
        { id: "https://openalex.org/W3", display_name: "No PDF" },
      ],
    });
    expect(papers[0]).toEqual({
      id: "W1",
      title: "Sink regulation of photosynthesis",
      authors: ["Matthew Paul"],
      year: 2001,
      field: "Agricultural and Biological Sciences",
      abstract: "Plants grow",
      pdfUrl: "https://example.org/paper.pdf",
    });
    expect(papers[1].pdfUrl).toBe("https://uni.edu/a.pdf");
    expect(papers[2].pdfUrl).toBeUndefined();
    expect(papers[2].authors).toEqual([]);
  });

  it("ignores malformed responses instead of crashing", () => {
    expect(parseResults(undefined)).toEqual([]);
    expect(parseResults({ results: "nope" })).toEqual([]);
    expect(parseResults({ results: [{ id: "x" }, { display_name: "no id" }] })).toEqual([]);
  });
});
