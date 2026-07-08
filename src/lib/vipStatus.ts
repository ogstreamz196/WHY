// Server-side VIP status lookup.
// Queries the subscriptions table to determine whether the user has an
// active VIP subscription in the current environment.
import type { SupabaseClient } from "@supabase/supabase-js";
import { computeCoinDrop } from "./coinDrop";

type AuthCtx = { supabase: SupabaseClient; userId: string };

function currentPaddleEnvFromServer(): "sandbox" | "live" {
  const token = process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "";
  return token.startsWith("test_") ? "sandbox" : "live";
}

export async function isVipUser(ctx: AuthCtx): Promise<boolean> {
  const env = currentPaddleEnvFromServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (ctx.supabase as any)
    .from("subscriptions")
    .select("status, current_period_end")
    .eq("user_id", ctx.userId)
    .eq("environment", env)
    .in("status", ["active", "trialing"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return false;
  const row = data as { status: string; current_period_end: string | null };
  if (!row.current_period_end) return true;
  return new Date(row.current_period_end).getTime() > Date.now();
}

/**
 * Convenience: compute the adjusted coin/point amount a user should receive,
 * applying the global 50% reduction and — for VIPs — the 2× multiplier.
 */
export async function awardAmountForUser(ctx: AuthCtx, base: number): Promise<number> {
  const isVip = await isVipUser(ctx);
  return computeCoinDrop(base, { isVip });
}
