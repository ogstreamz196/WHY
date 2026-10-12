// Why? Plus status for the signed-in user. See docs/WHY_PLUS.md.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PlusStatus } from "./plus.server";

export type { PlusStatus } from "./plus.server";

export const getMyPlus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlusStatus> => {
    const { getPlusStatus } = await import("./plus.server");
    return getPlusStatus(context.userId);
  });

/**
 * Called by the apps right after a purchase or "Restore purchases", so Plus
 * switches on immediately instead of waiting for RevenueCat's webhook.
 */
export const refreshMyPlus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PlusStatus> => {
    const { getPlusStatus, syncRevenueCat } = await import("./plus.server");
    try {
      await syncRevenueCat(context.userId);
    } catch (e) {
      console.warn("[plus] RevenueCat sync failed:", e);
    }
    return getPlusStatus(context.userId);
  });
