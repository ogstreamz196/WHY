import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SyncResult } from "./sync.server";

/** Boss-only: pull the latest rows from a Google Sheet into `facts`. See sync.server.ts. */
export const syncFactsFromSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => input ?? {})
  .handler(async ({ data, context }): Promise<SyncResult> => {
    const { data: isBoss, error } = await context.supabase.rpc("is_boss", { _uid: context.userId });
    if (error) throw new Error(error.message);
    if (!isBoss) throw new Error("Forbidden");
    const { SyncInput, runSheetSync } = await import("./sync.server");
    return runSheetSync(SyncInput.parse(data));
  });
