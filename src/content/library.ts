import avellanedaLee from "./avellaneda-lee-2008.json";
import type { Paper } from "./types";

// Papers built into the game. Real database search (arXiv) comes later.
export const LIBRARY: Paper[] = [avellanedaLee as Paper];

export function searchPapers(query: string, papers: Paper[] = LIBRARY): Paper[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  return papers.filter((paper) => {
    const haystack = [paper.title, paper.subject, paper.summary, String(paper.year), ...paper.authors]
      .join(" ")
      .toLowerCase();
    return words.every((word) => haystack.includes(word));
  });
}

export function findPaper(id: string, papers: Paper[] = LIBRARY): Paper | undefined {
  return papers.find((paper) => paper.id === id);
}
