// Shared helper: normalize a raw fact/question string into a proper
// "Why ...?" question. Kept isolated so both routes and quiz UI can use it.
export function asWhyQuestion(raw: string) {
  if (!raw) return raw;
  let q = raw.trim().replace(/^(do you know\s+)/i, "");
  // Collapse accidental repeated leading "why why ..."
  q = q.replace(/^(?:why\b[\s,?.!-]*)+/i, "why ").replace(/^why\s+(?=[?.!]|$)/i, "why");
  const startsWithWhy = /^(why|how come|how|what makes|what causes)\b/i.test(q);
  if (!startsWithWhy) q = `Why ${q.charAt(0).toLowerCase() + q.slice(1)}`;
  else q = q.charAt(0).toUpperCase() + q.slice(1);
  // Normalize trailing punctuation to a single '?'
  q = q.replace(/[?!.]+$/g, "");
  q += "?";
  return q;
}
