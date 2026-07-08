// Server-side VIP status lookup.
//
// While Paddle subscriptions are not yet wired up, `isVipUser` returns false
// for everyone. When the `subscriptions` table lands, replace the body with a
// query against it (e.g. `.eq('status', 'active').gt('current_period_end', now)`).
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCoinDrop } from "./coinDrop";

type AuthCtx = { supabase: SupabaseClient; userId: string };

export async function isVipUser(_ctx: AuthCtx): Promise<boolean> {
  // TODO: query public.subscriptions once the VIP subscription flow is enabled.
  // const { data } = await _ctx.supabase
  //   .from("subscriptions")
  //   .select("status, current_period_end")
  //   .eq("user_id", _ctx.userId)
  //   .eq("status", "active")
  //   .gt("current_period_end", new Date().toISOString())
  //   .maybeSingle();
  // return !!data;
  return false;
}

/**
 * Convenience: compute the adjusted coin/point amount a user should receive,
 * applying the global 50% reduction and — for VIPs — the 2× multiplier.
 */
export async function awardAmountForUser(ctx: AuthCtx, base: number): Promise<number> {
  const isVip = await isVipUser(ctx);
  return computeCoinDrop(base, { isVip });
}
