import { loadUploadedPapers } from "../save";
import avellanedaLee from "./avellaneda-lee-2008.json";
import type { Paper } from "./types";

// Papers built into the game, with hand-written lessons.
export const LIBRARY: Paper[] = [avellanedaLee as Paper];

// Built-in papers plus games made from the player's uploaded PDFs.
export function playablePapers(): Paper[] {
  return [...loadUploadedPapers(), ...LIBRARY];
}

export function searchPapers(query: string, papers: Paper[] = playablePapers()): Paper[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  return papers.filter((paper) => {
    const haystack = [paper.title, paper.subject, paper.summary, String(paper.year), ...paper.authors]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function findPaper(id: string, papers: Paper[] = playablePapers()): Paper | undefined {
  return papers.find((paper) => paper.id === id);
}
