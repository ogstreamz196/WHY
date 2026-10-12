// Shared leaderboard data for the Ranks page and the profile rankings.
// Reads through get_public_leaderboard (service role), which already applies
// leaderboard opt-outs and hidden profiles.
import type { LeaderboardEntry } from "./leaderboard.functions";

export type BoardKind =
  "global" | "age" | "category" | "window" | "rising" | "streaks" | "weekend" | "new";

export type LbRow = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  age_band: string | null;
  favorite_category: string | null;
  score: number;
};

const BOARD_KINDS: BoardKind[] = [
  "global",
  "age",
  "category",
  "window",
  "rising",
  "streaks",
  "weekend",
  "new",
];
const WINDOW_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30 };
const DEFAULT_CATEGORY = "animals";

const ROWS_TTL_MS = 30_000;
const rowsCache = new Map<string, { rows: LbRow[]; windowLabel: string | null; ts: number }>();

/** Ranked rows for a board, cached briefly and shared by every viewer. */
export async function getBoardRows(
  kind: string,
  filter: string | null | undefined,
): Promise<{ rows: LbRow[]; windowLabel: string | null }> {
  const safeKind: BoardKind = (BOARD_KINDS as string[]).includes(kind)
    ? (kind as BoardKind)
    : "global";
  // Without a category the database returns one row per user per category,
  // which duplicates players. Always rank a single category.
  const safeFilter = safeKind === "category" ? filter || DEFAULT_CATEGORY : (filter ?? null);

  const key = `${safeKind}::${safeFilter ?? ""}`;
  const cached = rowsCache.get(key);
  if (cached && Date.now() - cached.ts < ROWS_TTL_MS) return cached;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_public_leaderboard", {
    _kind: safeKind,
    _filter: safeFilter ?? undefined,
  });
  if (error) throw new Error(error.message);

  let rows: LbRow[] = (data ?? [])
    .map((r) => ({
      user_id: r.user_id,
      username: r.username,
      display_name: r.display_name,
      avatar_id: r.avatar_id,
      age_band: r.age_band,
      favorite_category: r.favorite_category,
      score: r.score ?? 0,
    }))
    // Players with no points yet aren't ranked; listing them only pads the
    // board and makes everyone's percentile look better than it is.
    .filter((r) => r.score > 0)
    // Stable sort keeps the database's tie-break (who got there first).
    .sort((a, b) => b.score - a.score);

  if (safeKind === "streaks" && rows.length > 0) rows = await dropBrokenStreaks(rows);

  let windowLabel: string | null = null;
  if (safeKind === "category") windowLabel = safeFilter;
  if (safeKind === "window")
    windowLabel = safeFilter && WINDOW_DAYS[safeFilter] ? safeFilter : "weekly";

  const entry = { rows, windowLabel, ts: Date.now() };
  rowsCache.set(key, entry);
  return entry;
}

/**
 * current_streak is only recalculated when someone next completes a daily
 * challenge, so a player who stopped weeks ago still shows their old streak.
 * Keep only streaks whose last challenge was today or yesterday (UTC).
 */
async function dropBrokenStreaks(rows: LbRow[]): Promise<LbRow[]> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("user_stats")
    .select("user_id, last_daily_challenge_day")
    .in(
      "user_id",
      rows.map((r) => r.user_id),
    );
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
  const alive = new Set(
    (data ?? [])
      .filter((s) => s.last_daily_challenge_day && s.last_daily_challenge_day >= yesterday)
      .map((s) => s.user_id),
  );
  return rows.filter((r) => alive.has(r.user_id));
}

export type RankedBoard = {
  entries: LeaderboardEntry[];
  total: number;
  my_rank: number | null;
  my_score: number | null;
  /** Players just above and below the viewer, when they're outside `entries`. */
  nearby: LeaderboardEntry[];
  /** Points the viewer needs to pass the player ranked just above them. */
  points_to_next: number | null;
};

export function rankRows(rows: LbRow[], me: string | null, limit: number): RankedBoard {
  // Rows arrive sorted by score, ties broken by who got there first.
  const toEntry = (r: LbRow, i: number): LeaderboardEntry => ({
    ...r,
    rank: i + 1,
    is_me: !!me && r.user_id === me,
  });
  const entries = rows.slice(0, limit).map(toEntry);
  const idx = me ? rows.findIndex((r) => r.user_id === me) : -1;
  const myRank = idx >= 0 ? idx + 1 : null;
  const myScore = idx >= 0 ? rows[idx].score : null;
  const nearby =
    idx >= limit
      ? rows
          .slice(Math.max(limit, idx - 2), idx + 3)
          .map((r, i) => toEntry(r, Math.max(limit, idx - 2) + i))
      : [];
  const pointsToNext = idx > 0 && myScore !== null ? rows[idx - 1].score - myScore + 1 : null;
  return {
    entries,
    total: rows.length,
    my_rank: myRank,
    my_score: myScore,
    nearby,
    points_to_next: pointsToNext,
  };
}
