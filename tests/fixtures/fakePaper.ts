import type { TextLine } from "../../src/generator/textLines";

// A small fake paper: big title, numbered headings, body text, references.
export const SECTIONS: Record<string, string[]> = {
  "1 Introduction": [
    "Photosynthesis converts light energy into chemical energy stored in glucose molecules.",
    "Green plants perform photosynthesis inside chloroplasts using the pigment chlorophyll.",
    "The light reactions capture photons and split water molecules to release oxygen gas.",
    "Chlorophyll absorbs red and blue light while reflecting green light back to our eyes.",
    "Without photosynthesis, almost no oxygen would exist in the atmosphere of the planet.",
    "Early experiments showed that chloroplasts alone can perform the light reactions in a dish.",
    "Scientists measured that plants fix about 120 billion tonnes of carbon every year.",
    "The study of photosynthesis connects biology, chemistry, and physics in one process.",
  ],
  "2 The light reactions": [
    "The light reactions take place in the thylakoid membranes of the chloroplasts.",
    "Photosystem II absorbs light first and passes excited electrons down a transport chain.",
    "The electron transport chain pumps protons and builds a gradient across the membrane.",
    "ATP synthase uses the proton gradient to produce ATP for the rest of the cell.",
    "Photosystem I then re-energizes the electrons so they can reduce NADPH molecules.",
    "Splitting water replaces the electrons lost by photosystem II during the light reactions.",
    "The oxygen released by the light reactions comes entirely from the split water molecules.",
    "About 30 percent of absorbed light energy ends up stored as ATP and NADPH.",
  ],
  "3 The Calvin cycle": [
    "The Calvin cycle uses ATP and NADPH from the light reactions to fix carbon dioxide.",
    "The enzyme rubisco attaches carbon dioxide to a five-carbon sugar called RuBP.",
    "Rubisco is probably the most abundant protein on Earth because plants need so much of it.",
    "Each turn of the Calvin cycle fixes one molecule of carbon dioxide into the sugar chain.",
    "Six turns of the Calvin cycle are needed to build one molecule of glucose for the plant.",
    "The Calvin cycle runs in the stroma, the fluid that surrounds the thylakoid membranes.",
    "When rubisco grabs oxygen instead of carbon dioxide, the plant wastes energy and carbon.",
    "Some plants evolved special leaf anatomy so rubisco sees more carbon dioxide than oxygen.",
  ],
};

export function fakePaper(): TextLine[] {
  const lines: TextLine[] = [{ text: "How Plants Make Food From Light", size: 18, page: 1 }];
  let page = 1;
  for (const [heading, sentences] of Object.entries(SECTIONS)) {
    lines.push({ text: heading, size: 14, page });
    for (const sentence of sentences) lines.push({ text: sentence, size: 10, page });
    page += 1;
  }
  lines.push({ text: "References", size: 14, page });
  lines.push({ text: "Smith J. A very important reference about photosynthesis and rubisco in plants.", size: 10, page });
  return lines;
}
