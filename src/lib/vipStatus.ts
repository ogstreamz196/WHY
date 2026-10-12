// Server-side Why? Plus checks (formerly VIP). Plus status comes from
// plus.server.ts, which combines website (Paddle) and app-store (RevenueCat)
// subscriptions.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCoinDrop } from "./coinDrop";

type AuthCtx = { supabase: SupabaseClient; userId: string };

/** True when the user has an active Why? Plus subscription on any platform. */
export async function isVipUser(ctx: AuthCtx): Promise<boolean> {
  const { getPlusStatus } = await import("./plus.server");
  return (await getPlusStatus(ctx.userId)).active;
}

/**
 * Coins a user receives for an activity. Plus no longer multiplies coins:
 * coins are leaderboard score, and money shouldn't buy rank.
 */
export async function awardAmountForUser(_ctx: AuthCtx, base: number): Promise<number> {
  return computeCoinDrop(base);
}
