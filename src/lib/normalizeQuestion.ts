// Normalize and validate a raw "why" question before persisting it.
// Storage format matches the DB convention: lowercase phrase (no leading
// "why", no trailing punctuation) that becomes a full question when passed
// through asWhyQuestion() at render time.
import { asWhyQuestion } from "./whyQuestion";

// Bad grammar patterns that indicate the rendered question will read
// awkwardly. If detected, the writer should rephrase.
const BAD_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  {
    re: /\bdoes\s+\w+(?:\s+\w+)?\s+(had|was|were|did|went|came|made|took|saw|got|gave|found|used|became|built|grew|flew|ran|invented|discovered|created|evolved)\b/i,
    reason: "past-tense verb after 'does' (e.g. 'why does X had Y')",
  },
  { re: /\bdo\s+\w+\s+(has|is|are|was|were|had)\b/i, reason: "auxiliary mismatch after 'do'" },
  { re: /\?\s*\?/, reason: "double question mark" },
  { re: /\bwhy\s+why\b/i, reason: "duplicated 'why'" },
];

export type NormalizeResult =
  | { ok: true; question: string; rendered: string }
  | { ok: false; reason: string; question: string; rendered: string };

export function normalizeStoredQuestion(raw: string): NormalizeResult {
  let q = (raw ?? "").trim();
  q = q.replace(/\s+/g, " ");
  // Strip common prefixes we add back at render time.
  q = q.replace(/^(do you (?:know|wonder)\s+)/i, "");
  q = q.replace(/^(?:why\b[\s,]*)+/i, "");
  // Strip trailing punctuation — asWhyQuestion re-adds a single "?".
  q = q.replace(/[?.!]+$/g, "").trim();
  // Lowercase first letter (storage convention).
  if (q.length > 0) q = q.charAt(0).toLowerCase() + q.slice(1);

  const rendered = asWhyQuestion(q);

  if (!q || q.length < 3) {
    return { ok: false, reason: "question is too short", question: q, rendered };
  }
  for (const { re, reason } of BAD_PATTERNS) {
    if (re.test(rendered)) return { ok: false, reason, question: q, rendered };
  }
  return { ok: true, question: q, rendered };
}
