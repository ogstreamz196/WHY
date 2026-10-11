import { z } from "zod";

/**
 * One-way sync: Google Sheet → Supabase `facts` table.
 *
 * Sheet layout (first row = headers, starting at A1):
 *   A: question   (required)
 *   B: answer     (required)
 *   C: category   (optional, e.g. "animals")
 *   D: fun_fact   (optional)
 *   E: row_id     (optional stable identifier; if empty we use the row number)
 *
 * Behaviour:
 *   - Rows are keyed by `sheet_id` = `<spreadsheetId>:<rowKey>`.
 *   - New rows           → inserted with source='sheet'.
 *   - Existing rows      → updated in place (question/answer/category/fun_fact).
 *   - Duplicates skipped when nothing changed.
 *   - AI-generated rows (source='ai', sheet_id IS NULL) are never touched.
 */

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

type SheetsResponse = { values?: string[][] };

async function fetchSheet(spreadsheetId: string, range: string): Promise<string[][]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error("Google Sheets connector not configured. Link the Google Sheets connector.");
  }
  const url = `${GATEWAY}/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": connKey,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets request failed [${res.status}]: ${body}`);
  }
  const data = (await res.json()) as SheetsResponse;
  return data.values ?? [];
}

export type SyncResult = {
  ok: true;
  spreadsheetId: string;
  scanned: number;
  inserted: number;
  updated: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

export const SyncInput = z.object({
  spreadsheetId: z
    .string()
    .min(10)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid spreadsheet id")
    .optional(),
  range: z.string().max(100).default("Facts!A1:E"),
});

/** Server-only: callers must authenticate (shared secret or Boss account) first. */
export async function runSheetSync(data: z.infer<typeof SyncInput>): Promise<SyncResult> {
  const spreadsheetId = data.spreadsheetId || process.env.WHY_SHEET_ID;
  if (!spreadsheetId) {
    throw new Error("No spreadsheetId provided and WHY_SHEET_ID secret is not set.");
  }
  const range = data.range;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const rows = await fetchSheet(spreadsheetId, range);
  if (rows.length < 2) {
    return { ok: true, spreadsheetId, scanned: 0, inserted: 0, updated: 0, skipped: 0, errors: [] };
  }

  // Skip header row.
  const dataRows = rows.slice(1);

  // Preload existing sheet-sourced rows for this spreadsheet.
  const prefix = `${spreadsheetId}:`;
  const { data: existing } = await supabaseAdmin
    .from("facts")
    .select("id, question, answer, category, fun_fact, sheet_id, source")
    .like("sheet_id", `${prefix}%`);

  const bySheetId = new Map<string, {
    id: string;
    question: string;
    answer: string;
    category: string | null;
    fun_fact: string | null;
    source: string;
  }>();
  for (const r of existing ?? []) {
    if (r.sheet_id) bySheetId.set(r.sheet_id as string, r as never);
  }

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const errors: SyncResult["errors"] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const rowNumber = i + 2; // 1-indexed + header
    const row = dataRows[i] ?? [];
    const question = (row[0] ?? "").trim();
    const answer = (row[1] ?? "").trim();
    const category = (row[2] ?? "").trim() || null;
    const fun_fact = (row[3] ?? "").trim() || null;
    const rowKey = (row[4] ?? "").trim() || `row-${rowNumber}`;

    if (!question || !answer) {
      if (question || answer) errors.push({ row: rowNumber, reason: "missing question or answer" });
      continue;
    }

    const sheet_id = `${prefix}${rowKey}`;
    const current = bySheetId.get(sheet_id);

    if (!current) {
      // INSERT — but guard against colliding with an AI-generated fact that
      // happens to share the exact question text (facts.question is unique
      // in this project). If so, we skip rather than clobber the AI row.
      const { data: dup } = await supabaseAdmin
        .from("facts")
        .select("id, source")
        .eq("question", question)
        .maybeSingle();
      if (dup && dup.source !== "sheet") {
        skipped++;
        errors.push({ row: rowNumber, reason: "question already exists as AI fact — not overwritten" });
        continue;
      }
      const { error } = await supabaseAdmin.from("facts").insert({
        question,
        answer,
        category,
        fun_fact,
        source: "sheet",
        sheet_id,
      });
      if (error) errors.push({ row: rowNumber, reason: error.message });
      else inserted++;
    } else {
      // UPDATE only if changed.
      const changed =
        current.question !== question ||
        current.answer !== answer ||
        (current.category ?? null) !== category ||
        (current.fun_fact ?? null) !== fun_fact;
      if (!changed) {
        skipped++;
        continue;
      }
      const { error } = await supabaseAdmin
        .from("facts")
        .update({ question, answer, category, fun_fact })
        .eq("id", current.id);
      if (error) errors.push({ row: rowNumber, reason: error.message });
      else updated++;
    }
  }

  return {
    ok: true,
    spreadsheetId,
    scanned: dataRows.length,
    inserted,
    updated,
    skipped,
    errors,
  };
}
