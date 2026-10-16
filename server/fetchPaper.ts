import { MAX_DOWNLOAD_BYTES, isWorkId, looksLikePdf, pdfCandidates } from "../src/content/paperSources";

// Downloads an open-access paper's PDF for the game, because browsers won't
// let a website download files from other sites directly. It only fetches
// PDF links that OpenAlex lists for the requested paper, so it can't be
// used to download arbitrary URLs.

const OPENALEX = "https://api.openalex.org/works/";
const MAX_TRIES = 4;
const USER_AGENT = "SuperScholar/1.0 (educational game; https://github.com/hrishikeshkhandade)";

function error(status: number, message: string): Response {
  return Response.json({ error: message }, { status, headers: { "x-content-type-options": "nosniff" } });
}

// Streams the PDF through while counting bytes, checking first that it
// really is a PDF and not a publisher's login page.
async function pdfStream(response: Response): Promise<ReadableStream<Uint8Array> | undefined> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (!response.body || declared > MAX_DOWNLOAD_BYTES) return undefined;
  const reader = response.body.getReader();
  const first = await reader.read();
  if (first.done || !looksLikePdf(first.value)) {
    await reader.cancel();
    return undefined;
  }
  let total = first.value.length;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(first.value);
    },
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) return controller.close();
      total += value.length;
      if (total > MAX_DOWNLOAD_BYTES) {
        await reader.cancel();
        return controller.error(new Error("PDF too large"));
      }
      controller.enqueue(value);
    },
    cancel() {
      return reader.cancel();
    },
  });
}

export async function handleFetchPaper(request: Request): Promise<Response> {
  if (request.method !== "GET") return error(405, "Only GET requests are allowed.");
  const id = new URL(request.url).searchParams.get("id") ?? "";
  if (!isWorkId(id)) return error(400, "Not a valid paper ID.");

  const work = await fetch(`${OPENALEX}${id}?select=best_oa_location,locations`, {
    signal: AbortSignal.timeout(5000),
  }).catch(() => undefined);
  if (!work?.ok) return error(502, "Couldn't reach the paper database.");

  for (const url of pdfCandidates(await work.json()).slice(0, MAX_TRIES)) {
    try {
      const response = await fetch(url, {
        // A strict "application/pdf" accept header makes some archives answer 404.
        headers: { "user-agent": USER_AGENT, accept: "application/pdf,*/*" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const stream = await pdfStream(response);
      if (!stream) continue;
      return new Response(stream, {
        headers: {
          "content-type": "application/pdf",
          // Pass each paper straight through to the player who asked for it;
          // never let the host's servers keep and re-serve copies, since free
          // papers come with different licenses.
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
        },
      });
    } catch {
      // That copy timed out or refused; try the next one.
    }
  }
  return error(404, "No free copy of this paper could be downloaded.");
}
