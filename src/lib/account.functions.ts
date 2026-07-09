// Server functions backing the account/gamification system.
// All operations use `requireSupabaseAuth` so RLS scopes them to the caller.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
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
  age_band: string | null;
  favorite_category: string | null;
  leaderboard_opt_out: boolean;
  hide_from_public: boolean;
};

const PROFILE_COLS =
  "id, display_name, username, avatar_id, bio, created_at, age_band, favorite_category, leaderboard_opt_out, hide_from_public";

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ProfileDTO | null> => {
    const { data, error } = await context.supabase
      .from("profiles")
      .select(PROFILE_COLS)
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
        age_band: z.enum(["under_10", "10_12", "teen", "adult"]).optional(),
        favorite_category: z.string().max(40).optional(),
        leaderboard_opt_out: z.boolean().optional(),
        hide_from_public: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ProfileDTO> => {
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq("id", context.userId)
      .select(PROFILE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as ProfileDTO;
  });

// -------------------- XP ledger --------------------

type AuthCtx = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

export type XpSource = "quiz" | "discovery" | "daily" | "streak" | "achievement" | "login" | "mission";

/** Record an XP award in the append-only ledger. Safe to call after `total_points` is bumped. */
export async function awardXp(ctx: AuthCtx, source: XpSource, points: number, category?: string | null): Promise<void> {
  if (!points || points <= 0) return;
  await (await admin()).from("xp_events").insert({
    user_id: ctx.userId,
    source,
    points,
    category: category ?? null,
  });
}


// -------------------- Stats --------------------

export type StatsDTO = {
  total_points: number;
  current_streak: number;
  longest_streak: number;
  facts_seen: number;
  last_active_day: string | null;
  last_daily_challenge_day: string | null;
  last_login_bonus_day: string | null;
};

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<StatsDTO> => {
    const { data, error } = await context.supabase
      .from("user_stats")
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day")
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
        last_login_bonus_day: null,
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
    const awardedPoints = await awardAmountForUser(context, DAILY_POINTS);
    const nextPoints = (existing?.total_points ?? 0) + awardedPoints;

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
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day")
      .single();
    if (error) throw new Error(error.message);

    await awardXp(context, "daily", awardedPoints);
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

    const [{ data: existing }, { data: fact }] = await Promise.all([
      (await admin()).from("user_stats").select("*").eq("user_id", context.userId).maybeSingle(),
      context.supabase.from("facts").select("category").eq("id", data.fact_id).maybeSingle(),
    ]);

    const DISCOVERY_POINTS_BASE = 1;
    const awardedPoints = await awardAmountForUser(context, DISCOVERY_POINTS_BASE);
    const patch = {
      user_id: context.userId,
      total_points: (existing?.total_points ?? 0) + awardedPoints,
      current_streak: existing?.current_streak ?? 0,
      longest_streak: existing?.longest_streak ?? 0,
      facts_seen: (existing?.facts_seen ?? 0) + 1,
      last_active_day: today(),
      last_daily_challenge_day: existing?.last_daily_challenge_day ?? null,
    };
    const { data: row, error } = await context.supabase
      .from("user_stats")
      .upsert(patch, { onConflict: "user_id" })
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day")
      .single();
    if (error) throw new Error(error.message);

    await awardXp(context, "discovery", awardedPoints, (fact as { category: string | null } | null)?.category ?? null);
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

// -------------------- Discovery history --------------------

export type DiscoveryEntry = {
  id: string;
  seen_at: string;
  fact: FavoriteFact | null;
};

export const listMyDiscoveries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(200).default(50) }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<DiscoveryEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("discoveries")
      .select("id, seen_at, facts:fact_id (id, question, answer, category, fun_fact)")
      .eq("user_id", context.userId)
      .order("seen_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      id: r.id as string,
      seen_at: r.seen_at as string,
      fact: (r as { facts: FavoriteFact | null }).facts ?? null,
    }));
  });

export const toggleFavorite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fact_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ favorited: boolean; newlyUnlocked: string[] }> => {
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
      return { favorited: false, newlyUnlocked: [] };
    }
    const { error } = await context.supabase
      .from("favorites")
      .insert({ user_id: context.userId, fact_id: data.fact_id });
    if (error) throw new Error(error.message);
    const newlyUnlocked = await runAchievementCheckForUser(context);
    return { favorited: true, newlyUnlocked };
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
  // Fetch richer signals in parallel (all scoped to the caller by RLS).
  const [favRes, chainsRes, discCatRes, missionsRes] = await Promise.all([
    context.supabase
      .from("favorites")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId),
    context.supabase
      .from("why_chains")
      .select("id, step_count")
      .eq("user_id", context.userId),
    context.supabase
      .from("discoveries")
      .select("facts:fact_id (category)")
      .eq("user_id", context.userId),
    context.supabase
      .from("daily_missions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("bonus_awarded", true),
  ]);

  const favCount = favRes.count ?? 0;
  const chains = (chainsRes.data ?? []) as Array<{ step_count: number | null }>;
  const chainCount = chains.length;
  const maxChain = chains.reduce((m, c) => Math.max(m, c.step_count ?? 0), 0);
  const missionsCompleted = missionsRes.count ?? 0;

  const catCounts = new Map<string, number>();
  const discRows = (discCatRes.data ?? []) as unknown as Array<{ facts: { category: string | null } | { category: string | null }[] | null }>;
  for (const r of discRows) {
    const f = Array.isArray(r.facts) ? r.facts[0] : r.facts;
    const c = f?.category;
    if (c) catCounts.set(c, (catCounts.get(c) ?? 0) + 1);
  }

  const distinctCats = catCounts.size;
  const topCatCount = [...catCounts.values()].reduce((m, n) => Math.max(m, n), 0);

  const rules: Record<string, boolean> = {
    // discovery
    first_question: stats.facts_seen >= 1,
    ten_facts: stats.facts_seen >= 10,
    facts_50: stats.facts_seen >= 50,
    hundred_questions: stats.facts_seen >= 100,
    facts_250: stats.facts_seen >= 250,
    facts_500: stats.facts_seen >= 500,
    facts_1000: stats.facts_seen >= 1000,
    // streak (current)
    streak_3: stats.current_streak >= 3,
    streak_7: stats.current_streak >= 7,
    streak_14: stats.current_streak >= 14,
    streak_30: stats.current_streak >= 30,
    streak_60: stats.current_streak >= 60,
    streak_100: stats.current_streak >= 100,
    // streak (longest)
    longest_streak_7: stats.longest_streak >= 7,
    longest_streak_30: stats.longest_streak >= 30,
    // points
    points_100: stats.total_points >= 100,
    points_500: stats.total_points >= 500,
    points_1000: stats.total_points >= 1000,
    points_2500: stats.total_points >= 2500,
    points_5000: stats.total_points >= 5000,
    points_10000: stats.total_points >= 10000,
    // chains
    chain_first: chainCount >= 1,
    chain_5: chainCount >= 5,
    why_chain_master: maxChain >= 5,
    chain_deep_10: maxChain >= 10,
    chain_deep_20: maxChain >= 20,
    chain_25: chainCount >= 25,
    // favorites
    fav_first: favCount >= 1,
    fav_10: favCount >= 10,
    fav_50: favCount >= 50,
    fav_100: favCount >= 100,
    // categories
    cat_3: distinctCats >= 3,
    cat_5: distinctCats >= 5,
    cat_10: distinctCats >= 10,
    cat_focus_25: topCatCount >= 25,
    // missions
    mission_first: missionsCompleted >= 1,
    mission_7: missionsCompleted >= 7,
    mission_30: missionsCompleted >= 30,
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

export async function runAchievementCheckForUser(context: AuthContext): Promise<string[]> {
  const { data: row } = await context.supabase
    .from("user_stats")
    .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!row) return [];
  return checkAchievements(context, row as StatsDTO);
}


// -------------------- Guest migration --------------------

export const migrateGuestData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        // NOTE: points/streak are intentionally NOT accepted from the client.
        // Guest activity does not confer server-verified progress and would
        // let any signed-in user self-award leaderboard points. Only genuine
        // guest artefacts (their favourited fact ids) are migrated.
        favorite_fact_ids: z.array(z.string().uuid()).max(500).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true; imported_favorites: number }> => {
    // Ensure a user_stats row exists but never bump points/streak from guest input.
    const { data: existing } = await context.supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      await context.supabase
        .from("user_stats")
        .upsert(
          {
            user_id: context.userId,
            total_points: 0,
            current_streak: 0,
            longest_streak: 0,
            facts_seen: 0,
            last_active_day: today(),
          },
          { onConflict: "user_id" },
        );
    }

    let imported = 0;
    if (data.favorite_fact_ids?.length) {
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

// -------------------- Daily login bonus --------------------

export type LoginBonusResult = {
  claimed: boolean;
  awarded_points: number;
  streak: number;
  stats: StatsDTO;
  next_available_at: string;
};

/** Claim today's login bonus. Idempotent per UTC day. Awards escalating XP with streak. */
export const claimDailyLoginBonus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LoginBonusResult> => {
    const t = today();
    const y = yesterday();
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);
    const nextAvailable = tomorrow.toISOString();

    const { data: existing } = await context.supabase
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (existing?.last_login_bonus_day === t) {
      return {
        claimed: false,
        awarded_points: 0,
        streak: existing.current_streak ?? 0,
        stats: existing as StatsDTO,
        next_available_at: nextAvailable,
      };
    }

    // Login-bonus escalation is computed from login-bonus dates only.
    // Do NOT overwrite `current_streak` — that field belongs to the
    // daily-challenge streak (see recordDailyChallenge). Otherwise a user
    // who missed yesterday's bonus but is still on a long challenge streak
    // would see their streak reset to 1 when they claim today's bonus.
    const loginStreak = existing?.last_login_bonus_day === y
      ? (existing?.current_streak ?? 0) + 1
      : 1;
    const baseBonus = Math.min(
      LOGIN_BONUS_MAX,
      LOGIN_BONUS_BASE + (loginStreak - 1) * LOGIN_BONUS_STREAK_STEP,
    );
    const bonus = await awardAmountForUser(context, baseBonus);
    const currentStreak = existing?.current_streak ?? 0;
    const longest = Math.max(existing?.longest_streak ?? 0, currentStreak);

    const { data: row, error } = await context.supabase
      .from("user_stats")
      .upsert(
        {
          user_id: context.userId,
          total_points: (existing?.total_points ?? 0) + bonus,
          current_streak: currentStreak,
          longest_streak: longest,
          facts_seen: existing?.facts_seen ?? 0,
          last_active_day: t,
          last_daily_challenge_day: existing?.last_daily_challenge_day ?? null,
          last_login_bonus_day: t,
        },
        { onConflict: "user_id" },
      )
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day")
      .single();
    if (error) throw new Error(error.message);

    await awardXp(context, "login", bonus);
    await checkAchievements(context, row as StatsDTO);
    return {
      claimed: true,
      awarded_points: bonus,
      streak: currentStreak,
      stats: row as StatsDTO,
      next_available_at: nextAvailable,
    };
  });
