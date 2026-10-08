import { describe, expect, it } from "vitest";
import { isWorkId, looksLikePdf, pdfCandidates } from "../src/content/paperSources";

describe("paper download sources", () => {
  it("lists every distinct PDF link, best first, upgraded to https", () => {
    expect(
      pdfCandidates({
        best_oa_location: { pdf_url: "https://journal.org/a.pdf" },
        locations: [
          { pdf_url: "https://journal.org/a.pdf" },
          { pdf_url: null },
          { pdf_url: "http://university.edu/a.pdf" },
          { pdf_url: "ftp://old.server/a.pdf" },
        ],
      }),
    ).toEqual(["https://journal.org/a.pdf", "https://university.edu/a.pdf"]);
    expect(pdfCandidates({})).toEqual([]);
  });

  it("only accepts real OpenAlex work IDs", () => {
    expect(isWorkId("W2154965090")).toBe(true);
    for (const bad of ["", "W", "https://evil.example", "W123/../x", "A123"]) expect(isWorkId(bad)).toBe(false);
  });

  it("tells a real PDF from an HTML login page", () => {
    expect(looksLikePdf(new TextEncoder().encode("%PDF-1.7 ..."))).toBe(true);
    expect(looksLikePdf(new TextEncoder().encode("<!doctype html>"))).toBe(false);
  });
});
