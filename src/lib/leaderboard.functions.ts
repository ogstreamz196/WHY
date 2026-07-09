// Multi-view leaderboards on top of the unified Curiosity Score.
// All views rank the same score — only the WHERE/window/GROUP changes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type LeaderboardKind =
  | "global"
  | "age"
  | "category"
  | "window"
  | "rising"
  | "streaks"
  | "weekend"
  | "new"
  | "quiz";

export type LeaderboardEntry = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  age_band: string | null;
  favorite_category: string | null;
  score: number;
  rank: number;
  is_me: boolean;
  is_vip?: boolean;
};

export type LeaderboardResult = {
  kind: LeaderboardKind;
  filter: string | null;
  entries: LeaderboardEntry[];
  total_users: number;
  my_rank: number | null;
  my_score: number | null;
  window_label: string | null;
};

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

function rank(rows: LbRow[], me: string, limit: number): {
  entries: LeaderboardEntry[];
  total: number;
  my_rank: number | null;
  my_score: number | null;
} {
  const sorted = [...rows].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  let myRank: number | null = null;
  let myScore: number | null = null;
  const entries = sorted.slice(0, limit).map((r, i) => {
    const isMe = r.user_id === me;
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
  if (myRank === null) {
    const idx = sorted.findIndex((r) => r.user_id === me);
    if (idx >= 0) {
      myRank = idx + 1;
      myScore = sorted[idx].score ?? 0;
    }
  }
  return { entries, total: sorted.length, my_rank: myRank, my_score: myScore };
}

export const getLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        kind: z.enum([
          "global", "age", "category", "window",
          "rising", "streaks", "weekend", "new", "quiz",
        ]).default("global"),
        filter: z.string().max(40).optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<LeaderboardResult> => {
    const me = context.userId;
    let rows: LbRow[] = [];
    let windowLabel: string | null = null;

    if (data.kind === "global") {
      const { data: r } = await context.supabase
        .from("leaderboard_global")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score");
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "age") {
      const band = data.filter ?? "adult";
      const { data: r } = await context.supabase
        .from("leaderboard_global")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score")
        .eq("age_band", band);
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "category") {
      const cat = data.filter ?? "";
      const { data: r } = await context.supabase
        .from("leaderboard_category")
        .select("user_id, username, display_name, avatar_id, age_band, score")
        .eq("category", cat);
      rows = ((r ?? []) as Array<Omit<LbRow, "favorite_category">>).map((x) => ({
        ...x,
        favorite_category: null,
      }));
      windowLabel = cat;
    } else if (data.kind === "window") {
      const win = (data.filter && WINDOW_DAYS[data.filter]) ? data.filter : "weekly";
      const days = WINDOW_DAYS[win];
      const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
      const { data: r } = await context.supabase
        .from("leaderboard_windowed")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score, created_at")
        .gte("created_at", since);
      // Aggregate again since the view groups by created_at as well
      const agg = new Map<string, LbRow>();
      for (const row of (r ?? []) as Array<LbRow & { created_at: string }>) {
        const cur = agg.get(row.user_id);
        if (cur) cur.score = (cur.score ?? 0) + (row.score ?? 0);
        else agg.set(row.user_id, { ...row, score: row.score ?? 0 });
      }
      rows = [...agg.values()];
      windowLabel = win;
    } else if (data.kind === "rising") {
      const { data: r } = await context.supabase
        .from("leaderboard_rising")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score");
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "streaks") {
      const { data: r } = await context.supabase
        .from("leaderboard_streaks")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score");
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "weekend") {
      const { data: r } = await context.supabase
        .from("leaderboard_weekend")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score");
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "new") {
      const { data: r } = await context.supabase
        .from("leaderboard_new")
        .select("user_id, username, display_name, avatar_id, age_band, favorite_category, score");
      rows = (r ?? []) as LbRow[];
    } else if (data.kind === "quiz") {
      const { data: qs } = await context.supabase
        .from("quiz_stats")
        .select("user_id, total_score");
      const stats = (qs ?? []) as Array<{ user_id: string; total_score: number | null }>;
      const ids = stats.map((s) => s.user_id);
      const { data: profs } = ids.length
        ? await context.supabase
            .from("profiles_public")
            .select("id, username, display_name, avatar_id, favorite_category, leaderboard_opt_out")
            .in("id", ids)
        : { data: [] as Array<{ id: string; username: string | null; display_name: string | null; avatar_id: string | null; favorite_category: string | null; leaderboard_opt_out: boolean | null }> };
      const pmap = new Map((profs ?? []).map((p) => [p.id, p]));
      rows = stats
        .map((s) => {
          const p = pmap.get(s.user_id);
          if (p?.leaderboard_opt_out) return null;
          return {
            user_id: s.user_id,
            username: p?.username ?? null,
            display_name: p?.display_name ?? null,
            avatar_id: p?.avatar_id ?? null,
            age_band: null,
            favorite_category: p?.favorite_category ?? null,
            score: s.total_score ?? 0,
          } as LbRow;
        })
        .filter((r): r is LbRow => r !== null);
    }


    const { entries, total, my_rank, my_score } = rank(rows, me, data.limit);
    return {
      kind: data.kind,
      filter: data.filter ?? null,
      entries,
      total_users: total,
      my_rank,
      my_score,
      window_label: windowLabel,
    };
  });

// -------------------- Personalised rankings for profile --------------------

export type MyRanking = {
  key: string;
  label: string;
  emoji: string;
  rank: number | null;
  total: number;
  percentile: number | null;
  message: string;
};

function pct(rank: number | null, total: number): number | null {
  if (!rank || !total) return null;
  return Math.max(1, Math.round((rank / total) * 100));
}

function msg(label: string, rank: number | null, p: number | null): string {
  if (!rank) return `Play more to enter the ${label} board`;
  if (p !== null && p <= 5) return `You are in the top ${p}% of ${label}`;
  if (p !== null && p <= 25) return `Climbing the ${label} board — top ${p}%`;
  return `You are #${rank} on the ${label} board`;
}

export const getMyRankings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyRanking[]> => {
    const me = context.userId;
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("age_band, favorite_category")
      .eq("id", me)
      .maybeSingle();
    const ageBand = (prof as { age_band: string | null } | null)?.age_band ?? null;
    const favCat = (prof as { favorite_category: string | null } | null)?.favorite_category ?? null;

    // Global
    const { data: g } = await context.supabase
      .from("leaderboard_global")
      .select("user_id, score");
    const gRows = ((g ?? []) as { user_id: string; score: number | null }[])
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const gRank = gRows.findIndex((r) => r.user_id === me);

    // Rising 7d
    const { data: rs } = await context.supabase
      .from("leaderboard_rising")
      .select("user_id, score");
    const rsRows = ((rs ?? []) as { user_id: string; score: number | null }[])
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    const rsRank = rsRows.findIndex((r) => r.user_id === me);

    // Weekly window
    const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: w } = await context.supabase
      .from("leaderboard_windowed")
      .select("user_id, score")
      .gte("created_at", since);
    const agg = new Map<string, number>();
    for (const row of (w ?? []) as { user_id: string; score: number | null }[]) {
      agg.set(row.user_id, (agg.get(row.user_id) ?? 0) + (row.score ?? 0));
    }
    const wRows = [...agg.entries()].sort((a, b) => b[1] - a[1]);
    const wRank = wRows.findIndex(([uid]) => uid === me);

    const rankings: MyRanking[] = [
      {
        key: "global",
        label: "Global Explorers",
        emoji: "🌎",
        rank: gRank >= 0 ? gRank + 1 : null,
        total: gRows.length,
        percentile: pct(gRank >= 0 ? gRank + 1 : null, gRows.length),
        message: msg("Global Explorers", gRank >= 0 ? gRank + 1 : null, pct(gRank >= 0 ? gRank + 1 : null, gRows.length)),
      },
      {
        key: "weekly",
        label: "This Week",
        emoji: "📅",
        rank: wRank >= 0 ? wRank + 1 : null,
        total: wRows.length,
        percentile: pct(wRank >= 0 ? wRank + 1 : null, wRows.length),
        message: msg("This Week", wRank >= 0 ? wRank + 1 : null, pct(wRank >= 0 ? wRank + 1 : null, wRows.length)),
      },
      {
        key: "rising",
        label: "Rising Stars",
        emoji: "🚀",
        rank: rsRank >= 0 ? rsRank + 1 : null,
        total: rsRows.length,
        percentile: pct(rsRank >= 0 ? rsRank + 1 : null, rsRows.length),
        message: msg("Rising Stars", rsRank >= 0 ? rsRank + 1 : null, pct(rsRank >= 0 ? rsRank + 1 : null, rsRows.length)),
      },
    ];

    if (ageBand) {
      const { data: a } = await context.supabase
        .from("leaderboard_global")
        .select("user_id, score")
        .eq("age_band", ageBand);
      const aRows = ((a ?? []) as { user_id: string; score: number | null }[])
        .sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
      const aRank = aRows.findIndex((r) => r.user_id === me);
      rankings.push({
        key: "age",
        label: `${ageBand.replace("_", "–")} Age Group`,
        emoji: "🎯",
        rank: aRank >= 0 ? aRank + 1 : null,
        total: aRows.length,
        percentile: pct(aRank >= 0 ? aRank + 1 : null, aRows.length),
        message: msg("your age group", aRank >= 0 ? aRank + 1 : null, pct(aRank >= 0 ? aRank + 1 : null, aRows.length)),
      });
    }

    if (favCat) {
      const { data: c } = await context.supabase
        .from("leaderboard_category")
        .select("user_id, score")
        .eq("category", favCat);
      const cRows = ((c ?? []) as { user_id: string; score: number | null }[])
        .sort((x, y) => (y.score ?? 0) - (x.score ?? 0));
      const cRank = cRows.findIndex((r) => r.user_id === me);
      rankings.push({
        key: "category",
        label: favCat,
        emoji: "🧠",
        rank: cRank >= 0 ? cRank + 1 : null,
        total: cRows.length,
        percentile: pct(cRank >= 0 ? cRank + 1 : null, cRows.length),
        message: msg(favCat, cRank >= 0 ? cRank + 1 : null, pct(cRank >= 0 ? cRank + 1 : null, cRows.length)),
      });
    }

    return rankings;
  });
