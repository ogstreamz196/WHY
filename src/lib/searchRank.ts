// Ranking for fact search. Pure functions so they can be tested and shared.

const STOPWORDS = new Set(
  (
    "why do does did is are was were the a an you know what how of in on to and or my we i " +
    "it its it's can could would should will be been have has had that this there their they " +
    "so get got make makes made some any about for with from at by as when where which who"
  ).split(" "),
);

/** Simple English stem: enough to match "cats"/"cat" and "flying"/"fly". */
export function stem(word: string): string {
  if (word.length > 5 && word.endsWith("ing")) return word.slice(0, -3);
  // "butterflies" → "butterfl", which also prefix-matches "butterfly".
  if (word.length > 4 && word.endsWith("ies")) return word.slice(0, -3);
  if (word.length > 4 && word.endsWith("es")) return word.slice(0, -2);
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) return word.slice(0, -1);
  return word;
}

/** The meaningful search words in a query: lower-case, letters and digits only. */
export function searchTerms(query: string): string[] {
  const words = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 2 && !STOPWORDS.has(w));
  return Array.from(new Set(words.map(stem))).slice(0, 6);
}

type Searchable = { question: string; answer: string };

function words(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * How well a fact matches: question words count most, then the answer.
 * Matching all terms, or the whole phrase, earns a bonus. 0 means no match.
 */
export function scoreFact(fact: Searchable, terms: string[], phrase: string): number {
  if (terms.length === 0) return 0;
  const q = words(fact.question);
  const a = words(fact.answer);
  let score = 0;
  let matched = 0;
  for (const t of terms) {
    const inQ = q.some((w) => w.startsWith(t));
    const inA = a.some((w) => w.startsWith(t));
    if (inQ) score += 3;
    if (inA) score += 1;
    if (inQ || inA) matched++;
  }
  if (matched === 0) return 0;
  if (matched === terms.length) score += 3;
  const p = phrase
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (p.length >= 4 && fact.question.toLowerCase().includes(p)) score += 5;
  return score;
}

/** Best matches first; ties keep the database order. */
export function rankFacts<T extends Searchable>(facts: T[], query: string, limit = 8): T[] {
  const terms = searchTerms(query);
  const phrase = query.replace(/^\s*(do you know )?why\s+/i, "").replace(/\?+\s*$/, "");
  return facts
    .map((f, i) => ({ f, i, s: scoreFact(f, terms, phrase) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, limit)
    .map((x) => x.f);
}
