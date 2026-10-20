// Daily mission + weekly recap server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  applyPoints,
  runAchievementCheckForUser,
  awardXp,
  CHAIN_MISSION_LAYERS,
} from "./account.functions";
import { awardAmountForUser } from "./vipStatus";

let _admin: Awaited<ReturnType<typeof loadAdmin>> | null = null;
async function loadAdmin() {
  const m = await import("@/integrations/supabase/client.server");
  return m.supabaseAdmin;
}
async function admin() {
  if (!_admin) _admin = await loadAdmin();
  return _admin;
}

const BONUS_POINTS_BASE = 50;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Rotate category-of-the-day deterministically per calendar day.
const ROTATION = [
  "space",
  "animals",
  "ocean",
  "science",
  "history",
  "body",
  "earth",
  "weather",
  "food",
  "technology",
  "dinosaurs",
] as const;

function categoryOfDay(dateStr: string): string {
  // day-of-year hash → stable per day
  const d = new Date(dateStr + "T00:00:00Z");
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const day = Math.floor((d.getTime() - start) / 86_400_000);
  return ROTATION[day % ROTATION.length];
}

export type MissionTask = "mystery" | "surprise" | "chain" | "category";

export type DailyMissionDTO = {
  date: string;
  mystery_done: boolean;
  surprise_done: boolean;
  chain_done: boolean;
  category_done: boolean;
  category_key: string;
  bonus_awarded: boolean;
  completed: boolean;
};

function toDTO(
  row: {
    mission_date: string;
    mystery_done: boolean;
    surprise_done: boolean;
    chain_done: boolean;
    category_done: boolean;
    category_key: string | null;
    bonus_awarded: boolean;
  } | null,
  dateStr: string,
): DailyMissionDTO {
  const category_key = row?.category_key ?? categoryOfDay(dateStr);
  const mystery_done = row?.mystery_done ?? false;
  const surprise_done = row?.surprise_done ?? false;
  const chain_done = row?.chain_done ?? false;
  const category_done = row?.category_done ?? false;
  return {
    date: dateStr,
    mystery_done,
    surprise_done,
    chain_done,
    category_done,
    category_key,
    bonus_awarded: row?.bonus_awarded ?? false,
    completed: mystery_done && surprise_done && chain_done && category_done,
  };
}

const MISSION_COLS =
  "mission_date, mystery_done, surprise_done, chain_done, category_done, category_key, bonus_awarded";

export const getTodayMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyMissionDTO> => {
    const t = today();
    const { data, error } = await context.supabase
      .from("daily_missions")
      .select(MISSION_COLS)
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toDTO(data, t);
  });

/**
 * Which of today's tasks the server's own records prove:
 * - mystery: read at least one fact today
 * - surprise: read at least two different facts today (the second came from Next)
 * - category: read a fact from today's theme
 * - chain: read enough "But… Why?" layers today
 */
export function verifiedMissionTasks(input: {
  discoveries: { fact_id: string; category: string | null }[];
  chainClaims: number;
  theme: string;
}): Record<MissionTask, boolean> {
  const distinct = new Set(input.discoveries.map((d) => d.fact_id)).size;
  return {
    mystery: distinct >= 1,
    surprise: distinct >= 2,
    category: input.discoveries.some((d) => d.category === input.theme),
    chain: input.chainClaims >= CHAIN_MISSION_LAYERS,
  };
}

/**
 * Tick today's mission tasks from server events (recordDiscovery, chain
 * claims). Only ever sets tasks to done, so parallel marks can't undo each
 * other. A fact ticks the theme task only when it is from today's theme.
 */
export async function markMissionFromServer(
  userId: string,
  marks: { mystery?: boolean; surprise?: boolean; chain?: boolean; factCategory?: string | null },
): Promise<void> {
  const db = await admin();
  const t = today();
  const { error: rowErr } = await db
    .from("daily_missions")
    .upsert(
      { user_id: userId, mission_date: t, category_key: categoryOfDay(t) },
      { onConflict: "user_id,mission_date", ignoreDuplicates: true },
    );
  if (rowErr) throw new Error(rowErr.message);

  const patch: { mystery_done?: true; surprise_done?: true; chain_done?: true } = {};
  if (marks.mystery) patch.mystery_done = true;
  if (marks.surprise) patch.surprise_done = true;
  if (marks.chain) patch.chain_done = true;
  if (Object.keys(patch).length > 0) {
    const { error } = await db
      .from("daily_missions")
      .update(patch)
      .eq("user_id", userId)
      .eq("mission_date", t);
    if (error) throw new Error(error.message);
  }
  if (marks.factCategory) {
    const { error } = await db
      .from("daily_missions")
      .update({ category_done: true })
      .eq("user_id", userId)
      .eq("mission_date", t)
      .eq("category_key", marks.factCategory);
    if (error) throw new Error(error.message);
  }
}

const TASK_SCHEMA = z.object({
  task: z.enum(["mystery", "surprise", "chain", "category"]),
  // Still accepted from older clients, but the server checks the fact itself.
  category_key: z.string().max(40).optional(),
});

/**
 * The client asks to tick a task; it is only ticked when the server's own
 * records (today's discoveries and chain claims) show it was done.
 */
export const markMissionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TASK_SCHEMA.parse(input))
  .handler(async ({ data, context }): Promise<DailyMissionDTO> => {
    const t = today();
    const db = await admin();
    const dayStart = `${t}T00:00:00Z`;

    const { data: existing } = await db
      .from("daily_missions")
      .select("category_key")
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();
    const theme = existing?.category_key ?? categoryOfDay(t);

    const [discRes, chainRes] = await Promise.all([
      db
        .from("discoveries")
        .select("fact_id, facts:fact_id (category)")
        .eq("user_id", context.userId)
        .gte("seen_at", dayStart)
        .limit(500),
      db
        .from("chain_layer_rewards")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .gte("claimed_at", dayStart),
    ]);
    if (discRes.error) throw new Error(discRes.error.message);
    type Row = {
      fact_id: string;
      facts: { category: string | null } | { category: string | null }[] | null;
    };
    const discoveries = ((discRes.data ?? []) as unknown as Row[]).map((r) => {
      const f = Array.isArray(r.facts) ? r.facts[0] : r.facts;
      return { fact_id: r.fact_id, category: f?.category ?? null };
    });
    const proven = verifiedMissionTasks({
      discoveries,
      chainClaims: chainRes.count ?? 0,
      theme,
    });

    if (proven[data.task]) {
      await markMissionFromServer(context.userId, {
        mystery: data.task === "mystery",
        surprise: data.task === "surprise",
        chain: data.task === "chain",
        factCategory: data.task === "category" ? theme : null,
      });
    }

    const { data: row, error } = await db
      .from("daily_missions")
      .select(MISSION_COLS)
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toDTO(row, t);
  });

export const claimMissionBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{
      awarded: boolean;
      points: number;
      total_points: number;
      newlyUnlocked: string[];
    }> => {
      const t = today();
      const { data: existing } = await context.supabase
        .from("daily_missions")
        .select("mystery_done, surprise_done, chain_done, category_done, bonus_awarded")
        .eq("user_id", context.userId)
        .eq("mission_date", t)
        .maybeSingle();
      if (!existing) return { awarded: false, points: 0, total_points: 0, newlyUnlocked: [] };
      const complete =
        existing.mystery_done &&
        existing.surprise_done &&
        existing.chain_done &&
        existing.category_done;
      if (!complete || existing.bonus_awarded) {
        const { data: s } = await (
          await admin()
        )
          .from("user_stats")
          .select("total_points")
          .eq("user_id", context.userId)
          .maybeSingle();
        return { awarded: false, points: 0, total_points: s?.total_points ?? 0, newlyUnlocked: [] };
      }
      // Only the request that flips bonus_awarded false → true gets paid.
      const { data: claimed, error: claimErr } = await (
        await admin()
      )
        .from("daily_missions")
        .update({ bonus_awarded: true, completed_at: new Date().toISOString() })
        .eq("user_id", context.userId)
        .eq("mission_date", t)
        .eq("bonus_awarded", false)
        .select("user_id");
      if (claimErr) throw new Error(claimErr.message);
      if (!claimed || claimed.length === 0) {
        const { data: s } = await (
          await admin()
        )
          .from("user_stats")
          .select("total_points")
          .eq("user_id", context.userId)
          .maybeSingle();
        return { awarded: false, points: 0, total_points: s?.total_points ?? 0, newlyUnlocked: [] };
      }

      const awardedPoints = await awardAmountForUser(context, BONUS_POINTS_BASE);
      const next = (await applyPoints(context.userId, awardedPoints)) ?? 0;
      await (
        await admin()
      )
        .from("user_stats")
        .update({ last_active_day: t })
        .eq("user_id", context.userId);
      await awardXp(context, "mission", awardedPoints);
      const newlyUnlocked = await runAchievementCheckForUser(context);
      return { awarded: true, points: awardedPoints, total_points: next, newlyUnlocked };
    },
  );

// -------- Weekly recap --------

export type WeeklyRecap = {
  start: string;
  end: string;
  discoveries: number;
  categories: { key: string; count: number; pct: number }[];
  new_achievements: { id: string; name: string; emoji: string }[];
  best_streak: number;
  current_streak: number;
  xp_earned_est: number;
  insight: string;
};

export const getWeeklyRecap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WeeklyRecap> => {
    const now = new Date();
    const start = new Date(now);
    start.setUTCDate(now.getUTCDate() - 6);
    start.setUTCHours(0, 0, 0, 0);
    const startIso = start.toISOString();
    const endIso = now.toISOString();

    const [discoveriesRes, statsRes, achRes] = await Promise.all([
      context.supabase
        .from("discoveries")
        .select("fact_id, seen_at, facts:fact_id(category)")
        .eq("user_id", context.userId)
        .gte("seen_at", startIso)
        .lte("seen_at", endIso),
      (await admin())
        .from("user_stats")
        .select("total_points, current_streak, longest_streak")
        .eq("user_id", context.userId)
        .maybeSingle(),
      (await admin())
        .from("user_achievements")
        .select("achievement_id, unlocked_at, achievements:achievement_id(name, emoji)")
        .eq("user_id", context.userId)
        .gte("unlocked_at", startIso),
    ]);

    type DiscoveryRow = { facts: { category: string | null } | null };
    const rows = (discoveriesRes.data ?? []) as DiscoveryRow[];
    const catCount = new Map<string, number>();
    rows.forEach((r) => {
      const k = r.facts?.category ?? "other";
      catCount.set(k, (catCount.get(k) ?? 0) + 1);
    });
    const total = rows.length;
    const categories = [...catCount.entries()]
      .map(([key, count]) => ({ key, count, pct: total ? Math.round((count / total) * 100) : 0 }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3);

    type AchRow = { achievement_id: string; achievements: { name: string; emoji: string } | null };
    const achievements = ((achRes.data ?? []) as AchRow[]).map((r) => ({
      id: r.achievement_id,
      name: r.achievements?.name ?? r.achievement_id,
      emoji: r.achievements?.emoji ?? "🏅",
    }));

    const top = categories[0];
    const insight =
      total === 0
        ? "A quiet week — a fresh mystery is waiting for you today."
        : top && top.pct >= 40
          ? `You leaned into ${top.key} this week — ${top.pct}% of your discoveries.`
          : `You explored ${categories.length} different topics this week — a true curious mind.`;

    return {
      start: startIso.slice(0, 10),
      end: endIso.slice(0, 10),
      discoveries: total,
      categories,
      new_achievements: achievements,
      best_streak: statsRes.data?.longest_streak ?? 0,
      current_streak: statsRes.data?.current_streak ?? 0,
      xp_earned_est: total * 5,
      insight,
    };
  });
