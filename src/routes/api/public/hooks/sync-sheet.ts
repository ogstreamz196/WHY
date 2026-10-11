import { createFileRoute } from "@tanstack/react-router";

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
        const expected = process.env.SYNC_SHEET_SECRET;
        if (!expected) {
          return Response.json(
            { ok: false, error: "sync_sheet_secret_not_configured" },
            { status: 503 },
          );
        }
        const provided = request.headers.get("x-sync-secret") ?? "";
        // Constant-time compare
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length) {
          return new Response("Unauthorized", { status: 401 });
        }
        const { timingSafeEqual } = await import("crypto");
        if (!timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let body: { spreadsheetId?: string; range?: string } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          /* empty body ok */
        }
        try {
          const { SyncInput, runSheetSync } = await import("@/lib/sync.server");
          const result = await runSheetSync(SyncInput.parse(body));
          return Response.json(result);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          return Response.json({ ok: false, error: msg }, { status: 500 });
        }
      },
      GET: async () =>
        Response.json({
          ok: true,
          hint: "POST here with x-sync-secret header (optionally with { spreadsheetId, range }) to sync facts from Google Sheets.",
        }),
    },
  },
});
