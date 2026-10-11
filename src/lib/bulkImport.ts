// Pure, unit-testable pieces of the bulk-import pipeline used by
// bossBulkImport* server functions. Keeping these free of Supabase/fetch
// lets tests exercise header validation and normalization without mocks.
import { normalizeStoredQuestion } from "@/lib/normalizeQuestion";

export const CATEGORY_SET = new Set([
  "animals",
  "space",
  "earth",
  "science",
  "body",
  "weather",
  "food",
  "history",
  "technology",
  "ocean",
  "dinosaurs",
]);

export type BulkImportCandidate = {
  question: string;
  answer: string;
  fun_fact: string | null;
  category: string | null;
};

export type BulkImportRowError = { row: number; reason: string };

export type ParseBulkImportResult = {
  candidates: BulkImportCandidate[];
  skipped: number;
  errors: BulkImportRowError[];
};

export class BulkImportHeaderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BulkImportHeaderError";
  }
}

/**
 * Turn raw sheet rows (row 0 = header) into normalized candidates.
 * Throws BulkImportHeaderError when required columns are missing.
 */
export function parseBulkImportRows(
  rows: string[][],
  opts: { range?: string; defaultCategory?: string } = {},
): ParseBulkImportResult {
  const out: ParseBulkImportResult = { candidates: [], skipped: 0, errors: [] };
  if (rows.length < 2) {
    out.errors.push({ row: 0, reason: "No data rows" });
    return out;
  }
  const header = rows[0].map((h) => (h ?? "").trim().toLowerCase());
  const idx = {
    question: header.findIndex((h) => h === "question" || h === "q"),
    answer: header.findIndex((h) => h === "answer" || h === "a"),
    fun: header.findIndex((h) => h === "fun_fact" || h === "fun fact" || h === "fun"),
    cat: header.findIndex((h) => h === "category" || h === "cat"),
  };
  if (idx.question < 0 || idx.answer < 0) {
    throw new BulkImportHeaderError("Sheet must have 'question' and 'answer' columns");
  }

  const tabName = (opts.range ?? "").split("!")[0].replace(/^'|'$/g, "").trim().toLowerCase();
  const tabCat = CATEGORY_SET.has(tabName) ? tabName : null;
  const dflt = (opts.defaultCategory ?? "").trim().toLowerCase();
  const fallbackCat = CATEGORY_SET.has(dflt) ? dflt : tabCat;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i] ?? [];
    const rowNum = i + 1;
    const rawQ = (r[idx.question] ?? "").trim();
    const rawA = (r[idx.answer] ?? "").trim();
    const fun = idx.fun >= 0 ? (r[idx.fun] ?? "").trim() : "";
    const catRaw = idx.cat >= 0 ? (r[idx.cat] ?? "").trim().toLowerCase() : "";
    const category = CATEGORY_SET.has(catRaw) ? catRaw : fallbackCat;

    if (!rawQ || !rawA) {
      out.skipped++;
      continue;
    }
    const norm = normalizeStoredQuestion(rawQ);
    if (!norm.ok) {
      out.errors.push({ row: rowNum, reason: norm.reason ?? "grammar" });
      continue;
    }
    out.candidates.push({
      question: norm.question,
      answer: rawA,
      fun_fact: fun || null,
      category,
    });
  }
  return out;
}

/**
 * Filter candidates whose question already exists in facts. Returns
 * { toInsert, dupes } so the caller can update skip counts.
 * `admin` is the supabase admin (or any client with .from().select().ilike()).
 */
export async function dedupeAgainstExisting(
  admin: any,
  candidates: BulkImportCandidate[],
): Promise<{ toInsert: BulkImportCandidate[]; dupes: number }> {
  const toInsert: BulkImportCandidate[] = [];
  let dupes = 0;
  for (const c of candidates) {
    const { data } = await admin
      .from("facts")
      .select("id")
      .ilike("question", c.question)
      .limit(1)
      .maybeSingle();
    if (data) dupes++;
    else toInsert.push(c);
  }
  return { toInsert, dupes };
}
