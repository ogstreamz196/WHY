// Daily mission + weekly recap server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAchievementCheckForUser } from "./account.functions";

const BONUS_POINTS = 50;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// Rotate category-of-the-day deterministically per calendar day.
const ROTATION = [
  "space", "animals", "ocean", "science", "history",
  "body", "earth", "weather", "food", "technology", "dinosaurs",
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

function toDTO(row: {
  mission_date: string;
  mystery_done: boolean;
  surprise_done: boolean;
  chain_done: boolean;
  category_done: boolean;
  category_key: string | null;
  bonus_awarded: boolean;
} | null, dateStr: string): DailyMissionDTO {
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

export const getTodayMission = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DailyMissionDTO> => {
    const t = today();
    const { data, error } = await context.supabase
      .from("daily_missions")
      .select("mission_date, mystery_done, surprise_done, chain_done, category_done, category_key, bonus_awarded")
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return toDTO(data, t);
  });

const TASK_SCHEMA = z.object({
  task: z.enum(["mystery", "surprise", "chain", "category"]),
  category_key: z.string().max(40).optional(),
});

export const markMissionTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => TASK_SCHEMA.parse(input))
  .handler(async ({ data, context }): Promise<DailyMissionDTO> => {
    const t = today();
    const cat = data.category_key ?? categoryOfDay(t);

    const { data: existing } = await context.supabase
      .from("daily_missions")
      .select("mission_date, mystery_done, surprise_done, chain_done, category_done, category_key, bonus_awarded")
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();

    const patch = {
      user_id: context.userId,
      mission_date: t,
      mystery_done: existing?.mystery_done ?? false,
      surprise_done: existing?.surprise_done ?? false,
      chain_done: existing?.chain_done ?? false,
      category_done: existing?.category_done ?? false,
      category_key: existing?.category_key ?? cat,
      bonus_awarded: existing?.bonus_awarded ?? false,
    };
    if (data.task === "mystery") patch.mystery_done = true;
    if (data.task === "surprise") patch.surprise_done = true;
    if (data.task === "chain") patch.chain_done = true;
    if (data.task === "category") patch.category_done = true;

    const { data: row, error } = await context.supabase
      .from("daily_missions")
      .upsert(patch, { onConflict: "user_id,mission_date" })
      .select("mission_date, mystery_done, surprise_done, chain_done, category_done, category_key, bonus_awarded")
      .single();
    if (error) throw new Error(error.message);
    return toDTO(row, t);
  });

export const claimMissionBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ awarded: boolean; points: number; total_points: number; newlyUnlocked: string[] }> => {
    const t = today();
    const { data: existing } = await context.supabase
      .from("daily_missions")
      .select("mystery_done, surprise_done, chain_done, category_done, bonus_awarded")
      .eq("user_id", context.userId)
      .eq("mission_date", t)
      .maybeSingle();
    if (!existing) return { awarded: false, points: 0, total_points: 0 };
    const complete = existing.mystery_done && existing.surprise_done && existing.chain_done && existing.category_done;
    if (!complete || existing.bonus_awarded) {
      const { data: s } = await context.supabase
        .from("user_stats").select("total_points").eq("user_id", context.userId).maybeSingle();
      return { awarded: false, points: 0, total_points: s?.total_points ?? 0 };
    }
    await context.supabase
      .from("daily_missions")
      .update({ bonus_awarded: true, completed_at: new Date().toISOString() })
      .eq("user_id", context.userId)
      .eq("mission_date", t);

    const { data: stats } = await context.supabase
      .from("user_stats").select("total_points").eq("user_id", context.userId).maybeSingle();
    const next = (stats?.total_points ?? 0) + BONUS_POINTS;
    await context.supabase.from("user_stats").upsert(
      { user_id: context.userId, total_points: next, last_active_day: t },
      { onConflict: "user_id" },
    );
    return { awarded: true, points: BONUS_POINTS, total_points: next };
  });

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
      context.supabase
        .from("user_stats")
        .select("total_points, current_streak, longest_streak")
        .eq("user_id", context.userId)
        .maybeSingle(),
      context.supabase
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
    const insight = total === 0
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
