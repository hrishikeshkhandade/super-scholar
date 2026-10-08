// Turns the positioned text pieces pdf.js gives us into lines of text, each
// with its font size, so headings (bigger text) can be told apart from body.

export interface TextLine {
  text: string;
  size: number;
  page: number;
}

export interface PdfTextItem {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

export function linesFromItems(items: PdfTextItem[], page: number): TextLine[] {
  const lines: TextLine[] = [];
  let parts: string[] = [];
  let lineY: number | undefined;
  let lineSize = 0;

  const finishLine = () => {
    const text = parts.join("").replace(/\s+/g, " ").trim();
    if (text) lines.push({ text, size: Math.round(lineSize * 10) / 10, page });
    parts = [];
    lineY = undefined;
    lineSize = 0;
  };

  for (const item of items) {
    const y = item.transform[5];
    const size = Math.hypot(item.transform[2], item.transform[3]) || 0;
    // A jump in height means a new line started.
    if (lineY !== undefined && Math.abs(y - lineY) > Math.max(size, lineSize, 1) * 0.5) finishLine();
    if (item.str) {
      if (parts.length > 0 && !/\s$/.test(parts[parts.length - 1]) && !/^\s/.test(item.str)) parts.push(" ");
      parts.push(item.str);
      lineY ??= y;
      lineSize = Math.max(lineSize, size);
    }
    if (item.hasEOL) finishLine();
  }
  finishLine();
  return lines;
}
