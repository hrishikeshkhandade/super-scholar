// Live paper search using OpenAlex (https://openalex.org), a free index of
// 250M+ research papers in every subject. No API key is needed, and it
// allows calls straight from the browser.

import { pdfCandidates } from "./paperSources";

const API = "https://api.openalex.org/works";
const FIELDS = "id,display_name,publication_year,authorships,primary_topic,best_oa_location,locations,abstract_inverted_index";

export interface OnlinePaper {
  id: string;
  title: string;
  authors: string[];
  year: number | undefined;
  field: string | undefined;
  abstract: string;
  // A free PDF link, if any copy of the paper has one; the game can then
  // download it and build a level without leaving the site.
  pdfUrl: string | undefined;
}

export function searchUrl(query: string, perPage = 3): string {
  const params = new URLSearchParams({
    search: query.trim(),
    // Papers without an abstract have too little to show or build a game from.
    filter: "has_abstract:true",
    per_page: String(perPage),
    select: FIELDS,
  });
  return `${API}?${params}`;
}

// OpenAlex stores abstracts as {word: [positions]} for legal reasons;
// put the words back in order.
export function abstractFromIndex(index: Record<string, number[]> | null | undefined): string {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.filter((word) => word !== undefined).join(" ");
}

interface RawWork {
  id?: string;
  display_name?: string | null;
  publication_year?: number | null;
  authorships?: { author?: { display_name?: string } }[];
  primary_topic?: { field?: { display_name?: string } } | null;
  best_oa_location?: { pdf_url?: string | null } | null;
  locations?: { pdf_url?: string | null }[] | null;
  abstract_inverted_index?: Record<string, number[]> | null;
}

export function parseResults(json: unknown): OnlinePaper[] {
  const results = (json as { results?: RawWork[] })?.results;
  if (!Array.isArray(results)) return [];
  return results
    .filter((work) => typeof work.id === "string" && typeof work.display_name === "string" && work.display_name.trim())
    .map((work) => ({
      id: work.id!.replace("https://openalex.org/", ""),
      title: work.display_name!.trim(),
      authors: (work.authorships ?? []).map((a) => a.author?.display_name).filter((name): name is string => !!name),
      year: work.publication_year ?? undefined,
      field: work.primary_topic?.field?.display_name,
      abstract: abstractFromIndex(work.abstract_inverted_index),
      pdfUrl: pdfCandidates(work)[0],
    }));
}

export async function searchOnline(query: string, signal?: AbortSignal): Promise<OnlinePaper[]> {
  const response = await fetch(searchUrl(query), { signal });
  if (!response.ok) throw new Error(`OpenAlex search failed (${response.status})`);
  return parseResults(await response.json());
}
