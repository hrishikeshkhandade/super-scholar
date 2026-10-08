import { linesFromItems, type PdfTextItem, type TextLine } from "./textLines";

export const MAX_PDF_BYTES = 40 * 1024 * 1024;
export const MAX_PDF_PAGES = 120;

// Reads the text of a PDF in the browser with pdf.js. pdf.js is loaded only
// when someone uploads a file, so it doesn't slow down the game's start.
export async function readPdfLines(
  data: ArrayBuffer,
  onProgress: (page: number, pages: number) => void,
): Promise<TextLine[]> {
  const pdfjs = await import("pdfjs-dist");
  const { default: workerUrl } = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

  // Safety with untrusted PDFs: we only extract text (pages are never
  // rendered), pdf.js runs in its own worker, and the site's security policy
  // blocks eval, so code hidden in a PDF has nothing it can run.
  const task = pdfjs.getDocument({ data, enableXfa: false });
  const pdf = await task.promise;
  const pages = Math.min(pdf.numPages, MAX_PDF_PAGES);
  const lines: TextLine[] = [];
  for (let number = 1; number <= pages; number++) {
    const page = await pdf.getPage(number);
    const content = await page.getTextContent();
    lines.push(...linesFromItems(content.items as PdfTextItem[], number));
    onProgress(number, pages);
  }
  await task.destroy(); // frees the worker
  return lines;
}
