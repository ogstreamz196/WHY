import { createFileRoute } from "@tanstack/react-router";
import { syncFactsFromSheet } from "@/lib/sync.functions";

/**
 * Public sync webhook — call from pg_cron or manually via curl to pull the
 * latest rows from the configured Google Sheet.
 *
 *   POST /api/public/hooks/sync-sheet
 *   { "spreadsheetId"?: "...", "range"?: "Facts!A1:E" }
 *
 * If spreadsheetId is omitted, the `WHY_SHEET_ID` secret is used.
 */
export const Route = createFileRoute("/api/public/hooks/sync-sheet")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: { spreadsheetId?: string; range?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* empty body ok */
        }
        try {
          const result = await syncFactsFromSheet({ data: body });
          return Response.json(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          hint: "POST here (optionally with { spreadsheetId, range }) to sync facts from Google Sheets.",
        }),
    },
  },
});
