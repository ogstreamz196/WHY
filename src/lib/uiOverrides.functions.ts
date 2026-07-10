// UI overrides: site-wide text/label edits and bottom-nav order.
// Public read (everyone sees the same edits). Boss-only writes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type UiOverridesMap = Record<string, any>;

export const getUiOverrides = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("ui_overrides").select("key, value");
    const map: Record<string, any> = {};
    for (const row of data ?? []) map[(row as any).key] = (row as any).value;
    return { overrides: map };
  } catch {
    return { overrides: {} as Record<string, any> };
  }
});

async function assertBoss(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_boss", { _uid: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const setUiOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; value: unknown }) =>
    z
      .object({
        key: z.string().min(1).max(160),
        value: z.any(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { error } = await context.supabase.from("ui_overrides").upsert(
      {
        key: data.key,
        value: data.value as any,
        updated_at: new Date().toISOString(),
        updated_by: context.userId,
      },
      { onConflict: "key" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const clearUiOverride = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string }) => z.object({ key: z.string().min(1).max(160) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { error } = await context.supabase.from("ui_overrides").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
