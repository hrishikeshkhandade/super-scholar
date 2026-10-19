import { loadUploadedPapers } from "../save";
import avellanedaLee from "./avellaneda-lee-2008.json";
import attention from "./showcase/attention-2017.json";
import bitcoin from "./showcase/bitcoin-2008.json";
import blackScholes from "./showcase/black-scholes-merton-2022.json";
import gan from "./showcase/gan-2014.json";
import type { Paper } from "./types";

// Papers built into the game: Avellaneda & Lee with hand-written lessons,
// then showcase papers made ahead of time with the AI pipeline
// (scripts/makeShowcase.ts), so they play instantly.
export const HAND_WRITTEN_PAPER_ID = avellanedaLee.id;
export const LIBRARY: Paper[] = [avellanedaLee, attention, bitcoin, gan, blackScholes] as Paper[];

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
