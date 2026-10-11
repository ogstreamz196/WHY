// Shared helper: normalize a raw fact/question string into a proper
// "Why does ...?" question. Kept isolated so both routes and quiz UI can use it.

const AUX_OR_WH = new Set([
  "does",
  "do",
  "did",
  "is",
  "are",
  "was",
  "were",
  "can",
  "could",
  "should",
  "would",
  "will",
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
  "the",
  "a",
  "an",
  "there",
]);

const BLOCKERS = new Set([
  "why",
  "how",
  "what",
  "when",
  "where",
  "which",
  "who",
  "that",
  "because",
  "if",
  "whether",
  "so",
]);
const PRONOUNS_PLURAL = new Set(["we", "you", "they", "i"]);
const PRONOUNS_SINGULAR = new Set(["he", "she", "it"]);

function singularize(word: string): string {
  const w = word;
  const lower = w.toLowerCase();
  if (["is", "was", "has", "does", "goes"].includes(lower)) return w;
  if (/[^aeiou]ies$/i.test(w)) return w.slice(0, -3) + "y";
  if (/(sses|shes|ches|xes|zes)$/i.test(w)) return w.slice(0, -2);
  if (/ss$/i.test(w)) return w;
  if (/[^s]s$/i.test(w)) return w.slice(0, -1);
  return w;
}

// Try to rewrite "Why <subject> <verb-s> ..." into
// "Why does <singular subject> <base verb> ..." for more natural phrasing.
// Past-tense signals — if present, leave the sentence in past tense.
const PAST_TENSE = new Set([
  "had",
  "was",
  "were",
  "did",
  "went",
  "came",
  "made",
  "took",
  "saw",
  "got",
  "gave",
  "found",
  "used",
  "became",
  "built",
  "grew",
  "flew",
  "ran",
  "sat",
  "stood",
  "told",
  "said",
  "knew",
  "thought",
  "brought",
  "caught",
  "taught",
  "wrote",
  "ate",
  "drank",
  "fell",
  "held",
  "kept",
  "left",
  "lost",
  "meant",
  "met",
  "paid",
  "put",
  "read",
  "sent",
  "shot",
  "slept",
  "spoke",
  "spent",
  "won",
  "wore",
  "used",
  "existed",
  "lived",
  "died",
  "evolved",
  "invented",
  "discovered",
  "created",
  "developed",
]);

function insertDoes(afterWhy: string): string {
  const trimmed = afterWhy.trimStart();
  if (!trimmed) return afterWhy;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return afterWhy;
  const firstBare = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
  if (AUX_OR_WH.has(firstBare) || BLOCKERS.has(firstBare)) return afterWhy;

  // Pronoun subjects tend to introduce clauses ("we ask why ...") — leave alone.
  if (PRONOUNS_PLURAL.has(firstBare) || PRONOUNS_SINGULAR.has(firstBare)) {
    return afterWhy;
  }

  // Bail on past-tense sentences ("dinosaurs had feathers", "romans built roads").
  // Also bail on common past-tense -ed verbs after a plural noun subject.
  for (const tok of tokens) {
    const t = tok.toLowerCase().replace(/[^a-z]/g, "");
    if (PAST_TENSE.has(t)) return afterWhy;
  }

  // Scan a short subject window for a present-tense -s verb.
  const maxScan = Math.min(tokens.length, 3);
  let verbIdx = -1;
  for (let i = 1; i < maxScan; i++) {
    const t = tokens[i].toLowerCase().replace(/[^a-z]/g, "");
    if (!t) continue;
    if (BLOCKERS.has(t) || AUX_OR_WH.has(t)) return afterWhy;
    if (["this", "its", "his", "hers", "ours", "yours", "theirs"].includes(t)) return afterWhy;
    if (/([^s]s|ies|sses|shes|ches|xes|zes)$/.test(t)) {
      verbIdx = i;
      break;
    }
  }
  if (verbIdx === -1) return afterWhy;

  const subject = tokens.slice(0, verbIdx).map(singularize);
  const verb = singularize(tokens[verbIdx]);
  const rest = tokens.slice(verbIdx + 1);
  return ["does", ...subject, verb, ...rest].join(" ");
}

export function asWhyQuestion(raw: string) {
  if (!raw) return raw;
  let q = raw.trim().replace(/^(do you know\s+)/i, "");
  // Collapse accidental repeated leading "why why ..."
  q = q.replace(/^(?:why\b[\s,?.!-]*)+/i, "why ").replace(/^why\s+(?=[?.!]|$)/i, "why");

  const startsWithWhy = /^why\b/i.test(q);
  const startsWithOtherWh = /^(how come|how|what makes|what causes)\b/i.test(q);

  if (!startsWithWhy && !startsWithOtherWh) {
    q = `Why ${q.charAt(0).toLowerCase() + q.slice(1)}`;
  } else {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  }

  // Upgrade "Why X Ys ..." → "Why does X Y ..." for more natural phrasing.
  if (/^why\b/i.test(q)) {
    const rest = q.slice(3); // after "Why"
    const rebuilt = insertDoes(rest.replace(/^\s+/, " "));
    q = "Why " + rebuilt.replace(/^\s+/, "");
  }

  // Normalize trailing punctuation to a single '?'
  q = q.replace(/[?!.]+$/g, "");
  q += "?";
  return q;
}
