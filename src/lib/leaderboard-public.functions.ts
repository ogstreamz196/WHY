// Public leaderboard reads — no auth required. Backed by leaderboard_* views
// which grant SELECT to anon.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import type {
  LeaderboardKind,
  LeaderboardEntry,
  LeaderboardResult,
} from "./leaderboard.functions";

const WINDOW_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };

type LbRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  age_band: string | null;
  favorite_category: string | null;
  score: number | null;
};

function rank(rows: LbRow[], me: string | null, limit: number) {
  const sorted = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  let myRank: number | null = null;
  let myScore: number | null = null;
  const entries: LeaderboardEntry[] = sorted.slice(0, limit).map((r, i) => {
    const isMe = !!me && r.user_id === me;
    if (isMe) {
      myRank = i + 1;
      myScore = r.score ?? 0;
    }
    return {
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_id: r.avatar_id,
      age_band: r.age_band,
      favorite_category: r.favorite_category,
      score: r.score ?? 0,
      rank: i + 1,
      is_me: isMe,
    };
  });
  if (me && myRank === null) {
    const idx = sorted.findIndex((r) => r.user_id === me);
    if (idx >= 0) {
      myRank = idx + 1;
      myScore = sorted[idx].score ?? 0;
    }
  }
  return { entries, total: sorted.length, my_rank: myRank, my_score: myScore };
}

export const getLeaderboardPublic = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z
          .enum([
            "global", "age", "category", "window",
            "rising", "streaks", "weekend", "new",
          ])
          .default("global"),
        filter: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).default(50),
        userId: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<LeaderboardResult> => {
    // In-memory TTL cache of the raw rows per (kind, filter). Keyed without
    // userId so all viewers share the same cached rows; per-user ranking is
    // computed on top after the cache lookup.
    const cacheKey = `${data.kind}::${data.filter ?? ""}`;
    const now = Date.now();
    const cached = rowsCache.get(cacheKey);
    let rows: LbRow[];
    let windowLabel: string | null = null;

    if (cached && now - cached.ts < ROWS_TTL_MS) {
      rows = cached.rows;
      windowLabel = cached.windowLabel;
    } else {
      const fetched = await fetchRows(data.kind, data.filter);
      rows = fetched.rows;
      windowLabel = fetched.windowLabel;
      rowsCache.set(cacheKey, { rows, windowLabel, ts: now });
    }

    const me = data.userId ?? null;
    const { entries, total, my_rank, my_score } = rank(rows, me, data.limit);

    // Enrich with VIP status for shown entries.
    const ids = entries.map((e) => e.user_id);
    const vipSet = ids.length ? await fetchVipSet(ids) : new Set<string>();
    for (const e of entries) e.is_vip = vipSet.has(e.user_id);

    return {
      kind: data.kind as LeaderboardKind,
      filter: data.filter ?? null,
      entries,
      total_users: total,
      my_rank,
      my_score,
      window_label: windowLabel,
    };
  });

async function fetchVipSet(userIds: string[]): Promise<Set<string>> {
  const env = (process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("test_") ? "sandbox" : "live";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data } = await (supabaseAdmin as any)
    .from("subscriptions")
    .select("user_id, status, current_period_end")
    .in("user_id", userIds)
    .eq("environment", env)
    .in("status", ["active", "trialing"]);
  const now = Date.now();
  const set = new Set<string>();
  for (const r of (data ?? []) as Array<{ user_id: string; current_period_end: string | null }>) {
    if (!r.current_period_end || new Date(r.current_period_end).getTime() > now) set.add(r.user_id);
  }
  return set;
}

const ROWS_TTL_MS = 30_000;
const rowsCache = new Map<string, { rows: LbRow[]; windowLabel: string | null; ts: number }>();

async function fetchRows(
  kind: string,
  filter: string | undefined,
): Promise<{ rows: LbRow[]; windowLabel: string | null }> {
    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
    const supabase = createClient<Database>(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    let rows: LbRow[] = [];
    let windowLabel: string | null = null;
    const cols =
      "user_id, username, display_name, avatar_id, age_band, favorite_category, score";

  if (kind === "global") {
      const { data: r } = await supabase.from("leaderboard_global").select(cols);
      rows = (r ?? []) as LbRow[];
  } else if (kind === "age") {
    const band = filter ?? "adult";
      const { data: r } = await supabase
        .from("leaderboard_global")
        .select(cols)
        .eq("age_band", band);
      rows = (r ?? []) as LbRow[];
  } else if (kind === "category") {
    const cat = filter ?? "";
      const { data: r } = await supabase
        .from("leaderboard_category")
        .select("user_id, username, display_name, avatar_id, age_band, score")
        .eq("category", cat);
      rows = ((r ?? []) as Array<Omit<LbRow, "favorite_category">>).map((x) => ({
        ...x,
        favorite_category: null,
      }));
      windowLabel = cat;
  } else if (kind === "window") {
    const win = filter && WINDOW_DAYS[filter] ? filter : "weekly";
      const days = WINDOW_DAYS[win];
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const { data: r } = await supabase
        .from("leaderboard_windowed")
        .select(`${cols}, created_at`)
        .gte("created_at", since);
      const agg = new Map<string, LbRow>();
      for (const row of (r ?? []) as Array<LbRow & { created_at: string }>) {
        const cur = agg.get(row.user_id);
        if (cur) cur.score = (cur.score ?? 0) + (row.score ?? 0);
        else agg.set(row.user_id, { ...row, score: row.score ?? 0 });
      }
      rows = [...agg.values()];
      windowLabel = win;
  } else if (kind === "rising") {
      const { data: r } = await supabase.from("leaderboard_rising").select(cols);
      rows = (r ?? []) as LbRow[];
  } else if (kind === "streaks") {
      const { data: r } = await supabase.from("leaderboard_streaks").select(cols);
      rows = (r ?? []) as LbRow[];
  } else if (kind === "weekend") {
      const { data: r } = await supabase.from("leaderboard_weekend").select(cols);
      rows = (r ?? []) as LbRow[];
  } else if (kind === "new") {
      const { data: r } = await supabase.from("leaderboard_new").select(cols);
      rows = (r ?? []) as LbRow[];
    }

  return { rows, windowLabel };
}
