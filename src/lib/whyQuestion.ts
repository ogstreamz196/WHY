// Shared helper: turn a stored fact phrase into a proper English question.
//
// Facts are stored as the clause that follows "Do you know why", for example
// "we have leap years" or "the sky is blue". Shown as-is after "Why" they read
// badly ("Why we have leap years?"), so this moves or adds the helping verb:
//   "we have leap years"     -> "Why do we have leap years?"
//   "the sky is blue"        -> "Why is the sky blue?"
//   "the Moon has phases"    -> "Why does the Moon have phases?"
//   "dinosaurs disappeared"  -> "Why did dinosaurs disappear?"
// Anything it can't read confidently is left as "Why <clause>?".

/** Helping verbs that swap places with the subject ("the sky is" -> "is the sky"). */
const AUX = new Set([
  "is",
  "are",
  "was",
  "were",
  "can",
  "could",
  "will",
  "would",
  "should",
  "might",
  "must",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "can't",
  "cannot",
  "couldn't",
  "won't",
  "wouldn't",
  "shouldn't",
  "don't",
  "doesn't",
  "didn't",
]);

/** A clause that already starts like a question ("do cats purr", "is grass green"). */
const QUESTION_START = new Set([
  ...AUX,
  "do",
  "does",
  "did",
  "has",
  "have",
  "had",
  "how",
  "what",
  "which",
  "who",
  "whom",
  "whose",
  "when",
  "where",
  "why",
]);

/** Words that start a new clause: the main verb comes before them. */
const CLAUSE_BREAKS = new Set([
  "when",
  "if",
  "because",
  "after",
  "before",
  "while",
  "that",
  "which",
  "who",
  "why",
  "how",
  "so",
  "since",
  "until",
  "whether",
  "though",
  "although",
]);

/** A word straight after one of these is a noun, not a verb ("the light", "some rocks"). */
const DETERMINERS = new Set([
  "the",
  "a",
  "an",
  "some",
  "many",
  "most",
  "all",
  "these",
  "those",
  "this",
  "that",
  "our",
  "your",
  "their",
  "its",
  "his",
  "her",
  "my",
  "every",
  "each",
  "no",
  "of",
]);

const PLURAL_PRONOUNS = new Set(["we", "you", "they", "i"]);
const SINGULAR_PRONOUNS = new Set(["it", "he", "she"]);

/** Everyday verbs found in kids' "why" facts (base form). */
const VERBS = new Set(
  (
    "have get grow change look seem like make light glow sing rumble need eat erupt purr taste pop " +
    "run smell spin turn stick spread help use know see feel blink float twinkle hibernate melt " +
    "fall wag hear sneeze yawn dream cry sleep shine fly swim move come go live sweat breathe " +
    "freeze boil burn bounce stretch shrink sink itch hurt sparkle shimmer glitter work happen " +
    "stay keep hide hunt migrate build dig jump climb crawl bite sting roar bark howl chirp hum " +
    "buzz rise orbit explode flow form appear disappear become cause contain produce protect " +
    "absorb reflect bend scatter travel last beat pump carry wrinkle heal bleed bruise tickle " +
    "laugh hiccup burp shiver blush wake forget remember think learn talk speak dance play wear " +
    "cook rot ripen sprout bloom wilt crack fizz foam drip slide roll flash flicker shed molt " +
    "lose want drink chew swallow digest communicate follow point face mean matter exist hold " +
    "pull push attract repel show give take let lay sound sweat smile cool warm heat lead call " +
    "start stop begin end open close fit drop leak echo vibrate invent evolve discover create " +
    "develop sail rule explore"
  ).split(/\s+/),
);

/** Irregular past tenses -> base form ("built" -> "build"). */
const IRREGULAR_PAST: Record<string, string> = {
  had: "have",
  got: "get",
  went: "go",
  came: "come",
  made: "make",
  took: "take",
  saw: "see",
  gave: "give",
  found: "find",
  became: "become",
  built: "build",
  grew: "grow",
  flew: "fly",
  ran: "run",
  knew: "know",
  thought: "think",
  ate: "eat",
  fell: "fall",
  held: "hold",
  kept: "keep",
  lost: "lose",
  wore: "wear",
  wrote: "write",
  began: "begin",
  sank: "sink",
  froze: "freeze",
  rose: "rise",
  shook: "shake",
  drank: "drink",
  sang: "sing",
  swam: "swim",
  spoke: "speak",
  stood: "stand",
  told: "tell",
  said: "say",
  brought: "bring",
  caught: "catch",
  taught: "teach",
  meant: "mean",
  met: "meet",
  paid: "pay",
  sent: "send",
  slept: "sleep",
  spent: "spend",
  won: "win",
};

const IRREGULAR_PRESENT: Record<string, string> = { has: "have", does: "do", goes: "go" };

function bare(token: string) {
  return token.toLowerCase().replace(/[^a-z']/g, "");
}

/** "rumbles" -> "rumble", "cries" -> "cry", "buzzes" -> "buzz". Null if not an -s form. */
function presentToBase(word: string): string | null {
  if (IRREGULAR_PRESENT[word]) return IRREGULAR_PRESENT[word];
  if (/[^aeiou]ies$/.test(word)) return word.slice(0, -3) + "y";
  if (/(sses|shes|ches|xes|zes|oes)$/.test(word)) return word.slice(0, -2);
  if (/[^su]s$/.test(word)) return word.slice(0, -1);
  return null;
}

/** "started" -> "start", "used" -> "use", "stopped" -> "stop". Null if not past tense. */
function pastToBase(word: string): string | null {
  if (IRREGULAR_PAST[word]) return IRREGULAR_PAST[word];
  if (word.length < 4 || !word.endsWith("ed")) return null;
  if (word.endsWith("ied")) return word.slice(0, -3) + "y";
  const stem = word.slice(0, -2);
  if (VERBS.has(stem)) return stem;
  if (VERBS.has(stem + "e")) return stem + "e";
  if (/([bdgmnprt])\1$/.test(stem) && VERBS.has(stem.slice(0, -1))) return stem.slice(0, -1);
  return null;
}

type Verb = { index: number; kind: "base" | "present" | "past"; base: string };

/** Find the main verb of a clause whose subject starts at token 0. */
function findVerb(words: string[], from: number, to: number): Verb | null {
  for (let i = from; i < to; i++) {
    const w = words[i];
    if (CLAUSE_BREAKS.has(w)) return null;
    // A word right after "the"/"some"/"our"… is part of the subject.
    if (DETERMINERS.has(words[i - 1] ?? "")) continue;
    if (VERBS.has(w)) return { index: i, kind: "base", base: w };
    const pres = presentToBase(w);
    if (pres && VERBS.has(pres)) return { index: i, kind: "present", base: pres };
    const past = pastToBase(w);
    if (past) return { index: i, kind: "past", base: past };
  }
  return null;
}

/** Rewrite a statement clause ("we have leap years") as a question clause. */
function toQuestionClause(clause: string): string {
  const tokens = clause.trim().split(/\s+/);
  if (tokens.length < 2) return clause.trim();
  const words = tokens.map(bare);
  const first = words[0];
  if (QUESTION_START.has(first)) return clause.trim();

  const join = (parts: string[]) => parts.join(" ");

  // "there are so many stars" -> "are there so many stars"
  if (first === "there") {
    if (AUX.has(words[1])) return join([tokens[1], tokens[0], ...tokens.slice(2)]);
    return clause.trim();
  }

  // "we're" / "it's" contractions -> "are we" / "is it"
  const contraction = first.match(/^(we|you|they|it|he|she)'(re|s)$/);
  if (contraction) {
    const aux = contraction[2] === "re" ? "are" : "is";
    return join([aux, tokens[0].replace(/'(re|s)$/i, ""), ...tokens.slice(1)]);
  }

  // Pronoun subjects: the very next word is the verb.
  if (PLURAL_PRONOUNS.has(first) || SINGULAR_PRONOUNS.has(first)) {
    const next = words[1];
    if (AUX.has(next)) return join([tokens[1], tokens[0], ...tokens.slice(2)]);
    const past = pastToBase(next);
    if (past) return join(["did", tokens[0], past, ...tokens.slice(2)]);
    if (SINGULAR_PRONOUNS.has(first)) {
      const base = presentToBase(next);
      if (base) return join(["does", tokens[0], base, ...tokens.slice(2)]);
      return clause.trim();
    }
    return join(["do", ...tokens]);
  }

  const limit = Math.min(tokens.length, 7);

  // 1. A helping verb in the first clause swaps with the subject:
  //    "some birds like parrots can talk" -> "can some birds like parrots talk".
  for (let i = 1; i < limit; i++) {
    if (CLAUSE_BREAKS.has(words[i])) break;
    if (AUX.has(words[i]) || (/^ha(s|ve|d)$/.test(words[i]) && words[i + 1] === "been")) {
      return join([tokens[i], ...tokens.slice(0, i), ...tokens.slice(i + 1)]);
    }
  }

  // 2. A main verb: add do / does / did.
  const verb = findVerb(words, 1, limit);
  if (!verb) return clause.trim();
  const subject = tokens.slice(0, verb.index);
  const rest = tokens.slice(verb.index + 1);
  if (verb.kind === "base") return join(["do", ...subject, tokens[verb.index], ...rest]);
  // "thunder rumbles and booms" -> "does thunder rumble and boom"
  if (verb.kind === "present" && bare(rest[0] ?? "") === "and" && rest[1]) {
    const second = presentToBase(bare(rest[1]));
    if (second) rest[1] = second;
  }
  return join([verb.kind === "present" ? "does" : "did", ...subject, verb.base, ...rest]);
}

export function asWhyQuestion(raw: string) {
  if (!raw) return raw;
  let q = raw.trim().replace(/^(?:do you know\s+(?:why\s+)?)+/i, "");
  // Collapse accidental repeated leading "why why ..."
  q = q.replace(/^(?:why\b[\s,?.!-]*)+/i, "why ").replace(/^why\s+(?=[?.!]|$)/i, "why");
  q = q.replace(/[?!.]+$/g, "").trim();

  if (/^(how come|how|what makes|what causes)\b/i.test(q)) {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  } else {
    const clause = q.replace(/^why\b\s*/i, "");
    const lowered = /^I\b/.test(clause) ? clause : clause.charAt(0).toLowerCase() + clause.slice(1);
    const rebuilt = clause ? toQuestionClause(lowered) : "";
    q = rebuilt ? `Why ${rebuilt}` : "Why";
  }
  return `${fixNames(q)}?`;
}

/** Capitalise names that facts often store in lower case. */
function fixNames(q: string) {
  return q
    .replace(/\bmars\b/g, "Mars")
    .replace(/\bearth\b/g, "Earth")
    .replace(/\bt[-. ]+rex\b/gi, "T. rex")
    .replace(/\bi\b/g, "I");
}
