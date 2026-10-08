// Picks where to download a paper's PDF from, using the copies OpenAlex
// lists for it. Shared by the browser (to know if "PLAY" is possible) and
// the server function that does the download.

export const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;

interface RawLocation {
  pdf_url?: string | null;
  is_oa?: boolean;
}

export interface RawWorkLocations {
  best_oa_location?: RawLocation | null;
  locations?: RawLocation[] | null;
}

// Every distinct PDF link, best one first. Plain http links are upgraded to
// https; most hosts support it, and we never download over plain http.
export function pdfCandidates(work: RawWorkLocations): string[] {
  const links = [work.best_oa_location, ...(work.locations ?? [])]
    .map((location) => location?.pdf_url)
    .filter((url): url is string => typeof url === "string" && /^https?:\/\//.test(url))
    .map((url) => url.replace(/^http:\/\//, "https://"));
  return [...new Set(links)];
}

// OpenAlex work IDs look like "W2154965090"; anything else is rejected
// before the server makes any request.
export function isWorkId(id: string): boolean {
  return /^W\d{1,12}$/.test(id);
}

// Real PDFs start with "%PDF"; publishers often answer with an HTML login
// page instead, which must not be treated as the paper.
export function looksLikePdf(bytes: Uint8Array): boolean {
  return bytes.length > 4 && String.fromCharCode(...bytes.slice(0, 4)) === "%PDF";
}
