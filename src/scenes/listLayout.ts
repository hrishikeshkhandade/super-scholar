import { LIBRARY } from "../content/library";
import type { Paper } from "../content/types";
import { GAME_WIDTH } from "../ui";

// Layout helpers for the centered "name ... count" lists in the Notebook and
// the level select.

const CHAR_WIDTH = 16; // the pixel font is monospace
const CURSOR_SPACE = 28; // the menu's ">" sits this far left of the labels
const ROW_HEIGHT = 36; // a 16px menu option plus its spacing
const LIST_AREA = { top: 110, bottom: 430 }; // the space under a screen's heading
const MAX_TITLE_CHARS = 26;

export const shorten = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text);

// The y that centers a list of this many options in the space under the
// heading (or under top, for a screen with more above its list).
export const listTop = (options: number, top = LIST_AREA.top) =>
  Math.max(top, Math.round((top + LIST_AREA.bottom - options * ROW_HEIGHT) / 2));

// The pixel font draws "fi" and "fl" as one letter, which would pull a row's
// count one letter left of the others. An invisible zero-width non-joiner
// between them keeps every letter its own width.
export const noLigatures = (text: string) => text.replace(/f(?=[il])/g, "f\u200C");

// Pads names with spaces so the counts line up in one column, and returns
// the x that centers the whole block.
export function tableLabels(rows: [string, string][]): { labels: string[]; x: number } {
  const nameWidth = Math.max(...rows.map(([name]) => name.length));
  const countWidth = Math.max(...rows.map(([, count]) => count.length));
  const labels = rows.map(([name, count]) => noLigatures(`${name.padEnd(nameWidth)}  ${count.padStart(countWidth)}`));
  const blockWidth = (nameWidth + 2 + countWidth) * CHAR_WIDTH + CURSOR_SPACE;
  return { labels, x: Math.round((GAME_WIDTH - blockWidth) / 2) + CURSOR_SPACE };
}

// A paper's short title. Uploads are tagged, since an upload can share a
// title with a built-in paper.
export const paperLabel = (paper: Paper) =>
  `${shorten(paper.title, MAX_TITLE_CHARS)}${LIBRARY.includes(paper) ? "" : " (UPLOAD)"}`;
