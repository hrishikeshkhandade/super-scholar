// Finds the paper's key terms: words and two-word phrases that come up a lot
// in some sections but not everywhere (a "TF-IDF" score), like
// "mean reversion" or "eigenportfolio".

const STOPWORDS = new Set(
  (
    "about above after again against also although among another based because been before being below between both " +
    "could does doing done down during each either even every first from further given have having here however into " +
    "itself just later least less like made make many more most much must near need next often only other others " +
    "over paper same section several shall should show shown since some such than that their them then there these " +
    "they this those though three through thus together under until upon used using very well were what when where " +
    "which while whom whose will with within without would your figure table equation results result case cases " +
    "number given note value values example consider considered also order terms term model models method methods " +
    "approach different important following particular general respect large small high higher lower time first second " +
    "data study studies analysis work works found find show shows et al corp corresponding respectively therefore " +
    "similarly instead previous above-mentioned simple simply typical typically called defined define defines " +
    "observe observed assume assumed assuming propose proposed obtain obtained perform performed compute computed " +
    "notice noticed seen describe described discuss discussed present presented"
  ).split(" "),
);

export interface Term {
  text: string; // as written most often in the paper, e.g. "Sharpe ratio"
  key: string; // lowercase, for matching
  score: number;
  count: number;
}

function words(text: string): string[] {
  return text.match(/[A-Za-z][A-Za-z-]*[A-Za-z]/g) ?? [];
}

function isContentWord(word: string): boolean {
  return word.length >= 4 && !STOPWORDS.has(word.toLowerCase());
}

export function findKeyTerms(sectionTexts: string[], limit = 40): Term[] {
  const termCounts = new Map<string, { count: number; forms: Map<string, number>; sections: Set<number> }>();
  const add = (form: string, section: number) => {
    const key = form.toLowerCase();
    const entry = termCounts.get(key) ?? { count: 0, forms: new Map(), sections: new Set() };
    entry.count += 1;
    entry.forms.set(form, (entry.forms.get(form) ?? 0) + 1);
    entry.sections.add(section);
    termCounts.set(key, entry);
  };

  sectionTexts.forEach((text, section) => {
    const list = words(text);
    list.forEach((word, i) => {
      if (isContentWord(word)) add(word, section);
      const next = list[i + 1];
      if (next && isContentWord(word) && isContentWord(next)) add(`${word} ${next}`, section);
    });
  });

  const sectionCount = Math.max(sectionTexts.length, 1);
  const terms: Term[] = [];
  for (const [key, entry] of termCounts) {
    const phrase = key.includes(" ");
    if (entry.count < (phrase ? 2 : 3)) continue;
    // Terms in every section (like "stock" in a stock paper) say little about
    // any one part, so they get only a small weight.
    const idf = Math.log(sectionCount / entry.sections.size) + 0.15;
    const text = [...entry.forms.entries()].sort((a, b) => b[1] - a[1])[0][0];
    // A single word usually written Capitalized (but not an acronym like ETF)
    // is a name, like an author, which makes a poor quiz answer.
    if (!phrase && /^[A-Z][a-z]/.test(text)) continue;
    // Phrases are more specific than single words, so they get a boost.
    terms.push({ text, key, count: entry.count, score: entry.count * idf * (phrase ? 2.5 : 1) });
  }
  terms.sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));

  // Drop terms that overlap a stronger one: single words inside a chosen
  // phrase ("ratio" when "Sharpe ratio" is in), and plurals ("signals" when
  // "signal" is in), so quiz choices are never near-duplicates.
  const chosen: Term[] = [];
  for (const term of terms) {
    const stem = (key: string) => key.split(" ").map((word) => word.replace(/(es|s)$/, ""));
    const overlaps = chosen.some((other) => {
      const [a, b] = [stem(term.key), stem(other.key)];
      return a.some((word) => b.includes(word)) && (a.length === 1 || b.length === 1 || a.join() === b.join());
    });
    if (!overlaps) chosen.push(term);
    if (chosen.length >= limit) break;
  }
  return chosen;
}

export function containsTerm(sentence: string, term: Term): boolean {
  return termPattern(term).test(sentence);
}

export function termPattern(term: Term, flags = "i"): RegExp {
  const escaped = term.key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/ /g, "\\s+");
  return new RegExp(`(?<![A-Za-z-])${escaped}(?![A-Za-z-])`, flags);
}
