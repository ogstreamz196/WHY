// Multi-view leaderboards on top of the unified Curiosity Score.
// All views rank the same score — only the WHERE/window/GROUP changes.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Outfit } from "./avatarItems";

export type LeaderboardKind =
  "global" | "age" | "category" | "window" | "rising" | "streaks" | "weekend" | "new" | "quiz";

export type LeaderboardEntry = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  avatar_outfit?: Outfit;
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
  /** Players just above and below the viewer when they're outside the top list. */
  nearby?: LeaderboardEntry[];
  /** Points the viewer needs to pass the player ranked just above them. */
  points_to_next?: number | null;
  window_label: string | null;
};

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
    // The leaderboard views only show the caller's own row under RLS, which
    // made every ranking read "#1 of 1". Use the same public boards as the
    // Ranks page instead.
    const { getBoardRows, rankRows } = await import("./leaderboardRows.server");
    const me = context.userId;
    const { data: prof } = await context.supabase
      .from("profiles")
      .select("age_band, favorite_category")
      .eq("id", me)
      .maybeSingle();
    const ageBand = prof?.age_band ?? null;
    const favCat = prof?.favorite_category ?? null;

    const boards: Array<{
      key: string;
      label: string;
      emoji: string;
      kind: string;
      filter?: string;
    }> = [
      { key: "global", label: "Global Explorers", emoji: "🌎", kind: "global" },
      { key: "weekly", label: "This Week", emoji: "📅", kind: "window", filter: "weekly" },
      { key: "streaks", label: "Streaks", emoji: "🔥", kind: "streaks" },
    ];
    if (ageBand) {
      boards.push({
        key: "age",
        label: `${ageBand.replace("_", "–")} Age Group`,
        emoji: "🎯",
        kind: "age",
        filter: ageBand,
      });
    }
    if (favCat) {
      boards.push({
        key: "category",
        label: favCat,
        emoji: "🧠",
        kind: "category",
        filter: favCat,
      });
    }

    return Promise.all(
      boards.map(async (b) => {
        const { rows } = await getBoardRows(b.kind, b.filter);
        const { my_rank, total } = rankRows(rows, me, 0);
        const p = pct(my_rank, total);
        return {
          key: b.key,
          label: b.label,
          emoji: b.emoji,
          rank: my_rank,
          total,
          percentile: p,
          message: msg(b.key === "age" ? "your age group" : b.label, my_rank, p),
        };
      }),
    );
  });
