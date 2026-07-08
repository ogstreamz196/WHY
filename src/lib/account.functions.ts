// Server functions backing the account/gamification system.
// All operations use `requireSupabaseAuth` so RLS scopes them to the caller.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DAILY_POINTS = 25;
const LOGIN_BONUS_BASE = 10;
const LOGIN_BONUS_STREAK_STEP = 2;
const LOGIN_BONUS_MAX = 100;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
function yesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

// -------------------- Profile --------------------

export type ProfileDTO = {
  id: string;
  display_name: string | null;
  username: string | null;
  avatar_id: string;
  bio: string | null;
  created_at: string;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileDTO | null> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select("id, display_name, username, avatar_id, bio, created_at")
      .eq("id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as ProfileDTO | null;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        display_name: z.string().trim().min(1).max(60).optional(),
        username: z
          .string()
          .trim()
          .min(3)
          .max(30)
          .regex(/^[a-zA-Z0-9_]+$/, "letters, numbers, underscore only")
          .optional(),
        avatar_id: z.string().max(60).optional(),
        bio: z.string().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ProfileDTO> => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId)
      .select("id, display_name, username, avatar_id, bio, created_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ProfileDTO;
  });

// -------------------- Stats --------------------

export type StatsDTO = {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  facts_seen: number;
  last_active_day: string | null;
  last_daily_challenge_day: string | null;
};

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsDTO> => {
    const { data, error } = await context.supabase
      .from("user_stats")
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        total_points: 0,
        current_streak: 0,
        longest_streak: 0,
        facts_seen: 0,
        last_active_day: null,
        last_daily_challenge_day: null,
      }
    );
  });

/** Record that the user completed today's Daily Challenge. Idempotent per day. */
export const recordDailyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ awarded: boolean; stats: StatsDTO; newlyUnlocked: string[] }> => {
    const t = today();
    const y = yesterday();

    const { data: existing } = await context.supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.last_daily_challenge_day === t) {
      return { awarded: false, stats: existing as StatsDTO, newlyUnlocked: [] };
    }

    const prevStreak = existing?.current_streak ?? 0;
    const nextStreak = existing?.last_daily_challenge_day === y ? prevStreak + 1 : 1;
    const longest = Math.max(existing?.longest_streak ?? 0, nextStreak);
    const nextPoints = (existing?.total_points ?? 0) + DAILY_POINTS;

    const patch = {
      user_id: context.userId,
      total_points: nextPoints,
      current_streak: nextStreak,
      longest_streak: longest,
      facts_seen: existing?.facts_seen ?? 0,
      last_active_day: t,
      last_daily_challenge_day: t,
    };
    const { data: row, error } = await context.supabase
      .from("user_stats")
      .upsert(patch, { onConflict: "user_id" })
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day")
      .single();
    if (error) throw new Error(error.message);

    const newlyUnlocked = await checkAchievements(context, row as StatsDTO);
    return { awarded: true, stats: row as StatsDTO, newlyUnlocked };
  });

/** Record that the user viewed/discovered a fact. Bumps facts_seen. */
export const recordDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fact_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ stats: StatsDTO; newlyUnlocked: string[] }> => {
    await context.supabase
      .from("discoveries")
      .insert({ user_id: context.userId, fact_id: data.fact_id });

    const { data: existing } = await context.supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const patch = {
      user_id: context.userId,
      total_points: existing?.total_points ?? 0,
      current_streak: existing?.current_streak ?? 0,
      longest_streak: existing?.longest_streak ?? 0,
      facts_seen: (existing?.facts_seen ?? 0) + 1,
      last_active_day: today(),
      last_daily_challenge_day: existing?.last_daily_challenge_day ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("user_stats")
      .upsert(patch, { onConflict: "user_id" })
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day")
      .single();
    if (error) throw new Error(error.message);

    const newlyUnlocked = await checkAchievements(context, row as StatsDTO);
    return { stats: row as StatsDTO, newlyUnlocked };
  });

// -------------------- Favorites --------------------

export type FavoriteFact = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  fun_fact: string | null;
};

export const listFavorites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FavoriteFact[]> => {
    const { data, error } = await context.supabase
      .from("favorites")
      .select("fact_id, created_at, facts:fact_id (id, question, answer, category, fun_fact)")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{ facts: FavoriteFact | null }>;
    return rows.map((r) => r.facts).filter((f): f is FavoriteFact => f !== null);
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fact_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ favorited: boolean }> => {
    const { data: existing } = await context.supabase
      .from("favorites")
      .select("id")
      .eq("user_id", context.userId)
      .eq("fact_id", data.fact_id)
      .maybeSingle();
    if (existing) {
      const { error } = await context.supabase
        .from("favorites")
        .delete()
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
      return { favorited: false };
    }
    const { error } = await context.supabase
      .from("favorites")
      .insert({ user_id: context.userId, fact_id: data.fact_id });
    if (error) throw new Error(error.message);
    return { favorited: true };
  });

// -------------------- Achievements --------------------

export type Achievement = {
  id: string;
  name: string;
  description: string;
  emoji: string;
  threshold: number | null;
  category: string;
  sort_order: number;
  unlocked_at: string | null;
};

export const listAchievements = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Achievement[]> => {
    const [{ data: catalog }, { data: mine }] = await Promise.all([
      context.supabase
        .from("achievements")
        .select("id, name, description, emoji, threshold, category, sort_order")
        .order("sort_order", { ascending: true }),
      context.supabase
        .from("user_achievements")
        .select("achievement_id, unlocked_at")
        .eq("user_id", context.userId),
    ]);
    const unlocked = new Map<string, string>();
    (mine ?? []).forEach((r) => unlocked.set(r.achievement_id, r.unlocked_at));
    return (catalog ?? []).map((a) => ({
      ...a,
      unlocked_at: unlocked.get(a.id) ?? null,
    }));
  });

type AuthContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

async function checkAchievements(context: AuthContext, stats: StatsDTO): Promise<string[]> {
  const rules: Record<string, boolean> = {
    first_question: stats.facts_seen >= 1,
    ten_facts: stats.facts_seen >= 10,
    hundred_questions: stats.facts_seen >= 100,
    streak_3: stats.current_streak >= 3,
    streak_7: stats.current_streak >= 7,
    streak_30: stats.current_streak >= 30,
    points_100: stats.total_points >= 100,
    points_500: stats.total_points >= 500,
  };
  const candidates = Object.entries(rules)
    .filter(([, ok]) => ok)
    .map(([id]) => id);
  if (candidates.length === 0) return [];

  const { data: already } = await context.supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", context.userId)
    .in("achievement_id", candidates);
  const have = new Set((already ?? []).map((r) => r.achievement_id));
  const toInsert = candidates.filter((id) => !have.has(id));
  if (toInsert.length === 0) return [];
  await context.supabase
    .from("user_achievements")
    .insert(toInsert.map((id) => ({ user_id: context.userId, achievement_id: id })));
  return toInsert;
}

// -------------------- Guest migration --------------------

export const migrateGuestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        points: z.number().int().min(0).max(1_000_000).optional(),
        streak: z.number().int().min(0).max(10_000).optional(),
        favorite_fact_ids: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; imported_favorites: number }> => {
    // Merge points/streak — only bump upwards, never lower.
    const { data: existing } = await context.supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    const nextPoints = Math.max(existing?.total_points ?? 0, data.points ?? 0);
    const nextStreak = Math.max(existing?.current_streak ?? 0, data.streak ?? 0);
    const nextLongest = Math.max(existing?.longest_streak ?? 0, data.streak ?? 0);

    await context.supabase
      .from("user_stats")
      .upsert(
        {
          user_id: context.userId,
          total_points: nextPoints,
          current_streak: nextStreak,
          longest_streak: nextLongest,
          facts_seen: existing?.facts_seen ?? 0,
          last_active_day: existing?.last_active_day ?? today(),
        },
        { onConflict: "user_id" },
      );

    let imported = 0;
    if (data.favorite_fact_ids?.length) {
      // Only insert those that actually exist in facts table and aren't already favorited.
      const { data: valid } = await context.supabase
        .from("facts")
        .select("id")
        .in("id", data.favorite_fact_ids);
      const validIds = (valid ?? []).map((r) => r.id);
      if (validIds.length > 0) {
        const rows = validIds.map((id) => ({ user_id: context.userId, fact_id: id }));
        const { error } = await context.supabase
          .from("favorites")
          .upsert(rows, { onConflict: "user_id,fact_id", ignoreDuplicates: true });
        if (!error) imported = validIds.length;
      }
    }

    return { ok: true, imported_favorites: imported };
  });
