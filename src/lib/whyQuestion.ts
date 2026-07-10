// Shared helper: normalize a raw fact/question string into a proper
// "Why does ...?" question. Kept isolated so both routes and quiz UI can use it.

const AUX_OR_WH = new Set([
  "does", "do", "did", "is", "are", "was", "were", "can",
  "could", "should", "would", "will", "has", "have", "had",
  "how", "what", "which", "who", "whom", "whose", "when", "where",
  "the", "a", "an", "there",
]);

function singularize(word: string): string {
  const w = word;
  const lower = w.toLowerCase();
  // Irregulars — keep as-is
  if (["is", "was", "has", "does", "goes"].includes(lower)) return w;
  if (/[^aeiou]ies$/i.test(w)) return w.slice(0, -3) + "y";
  if (/(sses|shes|ches|xes|zes)$/i.test(w)) return w.slice(0, -2);
  if (/ss$/i.test(w)) return w;
  if (/[^s]s$/i.test(w)) return w.slice(0, -1);
  return w;
}

// Try to rewrite "Why <subject> <verb-s> ..." into
// "Why does <singular subject> <base verb> ..." for more natural phrasing.
function insertDoes(afterWhy: string): string {
  const trimmed = afterWhy.trimStart();
  if (!trimmed) return afterWhy;
  const tokens = trimmed.split(/\s+/);
  if (tokens.length < 2) return afterWhy;
  const first = tokens[0].toLowerCase().replace(/[^a-z]/g, "");
  // Already an auxiliary / wh-word / determiner => leave alone
  if (AUX_OR_WH.has(first)) return afterWhy;

  // Find a candidate verb ending in "s" within the first few tokens
  // (subject may be 1-3 words: "the red car goes ...").
  const maxScan = Math.min(tokens.length, 4);
  let verbIdx = -1;
  for (let i = 1; i < maxScan; i++) {
    const t = tokens[i].toLowerCase().replace(/[^a-z]/g, "");
    if (!t) continue;
    if (AUX_OR_WH.has(t)) return afterWhy; // e.g. "why cats are ..."
    if (/[^s]s$|ies$|(sses|shes|ches|xes|zes)$/.test(t) && t !== "this" && t !== "its" && t !== "his") {
      verbIdx = i;
      break;
    }
  }
  if (verbIdx === -1) return afterWhy;

  // Depluralize each subject token (best-effort) and base-form the verb.
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
