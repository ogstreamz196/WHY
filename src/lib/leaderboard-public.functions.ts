// Public leaderboard reads — no auth required. Rows come from
// get_public_leaderboard via the service role (see leaderboardRows.server.ts),
// which applies leaderboard opt-outs and hidden profiles.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { LeaderboardKind, LeaderboardResult } from "./leaderboard.functions";

export const getLeaderboardPublic = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z
          .enum(["global", "age", "category", "window", "rising", "streaks", "weekend", "new"])
          .default("global"),
        filter: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        // Only used to highlight the viewer's own row and position.
        userId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LeaderboardResult> => {
    const { getBoardRows, rankRows } = await import("./leaderboardRows.server");
    const { rows, windowLabel } = await getBoardRows(data.kind, data.filter);
    const board = rankRows(rows, data.userId ?? null, data.limit);

    // Enrich shown players with VIP status.
    const shown = [...board.entries, ...board.nearby];
    const vipSet = shown.length
      ? await fetchVipSet(shown.map((e) => e.user_id))
      : new Set<string>();
    for (const e of shown) e.is_vip = vipSet.has(e.user_id);

    return {
      kind: data.kind as LeaderboardKind,
      filter: data.filter ?? null,
      entries: board.entries,
      total_users: board.total,
      my_rank: board.my_rank,
      my_score: board.my_score,
      nearby: board.nearby,
      points_to_next: board.points_to_next,
      window_label: windowLabel,
    };
  });

async function fetchVipSet(userIds: string[]): Promise<Set<string>> {
  const env = (process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("test_")
    ? "sandbox"
    : "live";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("subscriptions")
    .select("user_id, status, current_period_end")
    .in("user_id", userIds)
    .eq("environment", env)
    .in("status", ["active", "trialing"]);
  const now = Date.now();
  const set = new Set<string>();
  for (const r of data ?? []) {
    if (!r.current_period_end || new Date(r.current_period_end).getTime() > now) set.add(r.user_id);
  }
  return set;
}
