// Server functions backing the account/gamification system.
// All operations use `requireSupabaseAuth` so RLS scopes them to the caller.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { awardAmountForUser, isVipUser } from "./vipStatus";
import { STORE_CATALOG } from "./store";
import type { Database } from "@/integrations/supabase/types";

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
  avatar_url: string | null;
  bio: string | null;
  created_at: string;
  age_band: string | null;
  favorite_category: string | null;
  leaderboard_opt_out: boolean;
  hide_from_public: boolean;
  status_message: string | null;
};

const PROFILE_COLS =
  "id, display_name, username, avatar_id, avatar_url, bio, created_at, age_band, favorite_category, leaderboard_opt_out, hide_from_public, status_message";

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
        status_message: z.string().trim().max(60).nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ProfileDTO> => {
    // status_message is a VIP-only feature — silently drop for non-VIPs.
    const patch: Record<string, unknown> = { ...data };
    if ("status_message" in patch) {
      if (!(await isVipUser(context))) delete patch.status_message;
    }
    // Store avatars must be owned (or, for VIP-exclusive ones, the user must be VIP).
    if (data.avatar_id) {
      const item = STORE_CATALOG.find((i) => i.id === data.avatar_id && i.category === "avatar");
      if (item?.vipOnly) {
        if (!(await isVipUser(context))) throw new Error("That avatar is for VIP members.");
      } else if (item && item.cost > 0) {
        const { data: owned } = await (
          await admin()
        )
          .from("user_inventory")
          .select("item_id")
          .eq("user_id", context.userId)
          .eq("item_id", item.id)
          .maybeSingle();
        if (!owned) throw new Error("You don't own that avatar yet.");
      }
    }
    const { data: row, error } = await context.supabase
      .from("profiles")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", context.userId)
      .select(PROFILE_COLS)
      .single();
    if (error) throw new Error(error.message);
    return row as ProfileDTO;
  });

// -------------------- Linked identities --------------------

export type LinkedIdentityDTO = {
  provider: string;
  email: string | null;
  linked_at: string | null;
};

/** List OAuth providers currently linked to the caller's auth user. */
export const listMyLinkedIdentities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<LinkedIdentityDTO[]> => {
    const db = await admin();
    const { data, error } = await db.auth.admin.getUserById(context.userId);
    if (error) throw new Error(error.message);
    const ids = data.user?.identities ?? [];
    return ids.map((i) => ({
      provider: i.provider,
      email: (i.identity_data?.email as string | undefined) ?? null,
      linked_at: i.created_at ?? null,
    }));
  });

/**
 * Copy the linked Google identity's name & avatar into the local profile.
 * - `avatar_url` is always refreshed from Google.
 * - `display_name` is only set when the profile has none yet (preserves any
 *   nickname the user already chose).
 * Safe to call on every sign-in — no-op when the user has no Google identity.
 */
export const syncGoogleIdentityToProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ synced: boolean; patch: { display_name?: string; avatar_url?: string } }> => {
      const db = await admin();
      const { data, error } = await db.auth.admin.getUserById(context.userId);
      if (error) throw new Error(error.message);
      const google = (data.user?.identities ?? []).find((i) => i.provider === "google");
      if (!google) return { synced: false, patch: {} };

      const meta = (google.identity_data ?? {}) as Record<string, unknown>;
      const rawName = (meta.full_name ?? meta.name ?? meta.given_name) as string | undefined;
      const rawAvatar = (meta.avatar_url ?? meta.picture) as string | undefined;

      const patch: { display_name?: string; avatar_url?: string } = {};
      if (rawAvatar && typeof rawAvatar === "string") patch.avatar_url = rawAvatar;

      const { data: existing } = await db
        .from("profiles")
        .select("display_name")
        .eq("id", context.userId)
        .maybeSingle();
      const hasName = !!existing?.display_name && existing.display_name.trim().length > 0;
      if (!hasName && rawName && typeof rawName === "string")
        patch.display_name = rawName.trim().slice(0, 60);

      if (Object.keys(patch).length === 0) return { synced: false, patch: {} };

      const { error: updErr } = await db
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", context.userId);
      if (updErr) throw new Error(updErr.message);
      return { synced: true, patch };
    },
  );

// -------------------- XP ledger --------------------

type AuthCtx = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

export type XpSource =
  "quiz" | "discovery" | "daily" | "streak" | "achievement" | "login" | "mission" | "chain";

/** Record an XP award in the append-only ledger. Safe to call after `total_points` is bumped. */
export async function awardXp(
  ctx: AuthCtx,
  source: XpSource,
  points: number,
  category?: string | null,
): Promise<void> {
  if (!points || points <= 0) return;
  await (await admin()).from("xp_events").insert({
    user_id: ctx.userId,
    source,
    points,
    category: category ?? null,
  });
}

/**
 * Atomically add points (or spend them, with a negative value). Returns the
 * new balance, or null when a debit would take the balance below zero.
 */
export async function applyPoints(
  userId: string,
  points: number,
  factsSeen = 0,
): Promise<number | null> {
  const { data, error } = await (
    await admin()
  ).rpc("apply_points", {
    _user: userId,
    _points: points,
    _facts_seen: factsSeen,
  });
  if (error) throw new Error(error.message);
  const { syncPeopleSoon } = await import("@/lib/backup.server");
  await syncPeopleSoon();
  return data as number | null;
}

const STATS_COLS =
  "total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day";

async function ensureStatsRow(userId: string): Promise<void> {
  await (
    await admin()
  )
    .from("user_stats")
    .upsert({ user_id: userId }, { onConflict: "user_id", ignoreDuplicates: true });
}

async function readStats(userId: string): Promise<StatsDTO> {
  const { data, error } = await (
    await admin()
  )
    .from("user_stats")
    .select(STATS_COLS)
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(error.message);
  return data as StatsDTO;
}

/**
 * Compare-and-set on a per-day column: the update only applies if the column
 * still holds the value we read, so two concurrent claims can't both win.
 */
async function claimDay(
  userId: string,
  column: "last_daily_challenge_day" | "last_login_bonus_day",
  previous: string | null,
  patch: Database["public"]["Tables"]["user_stats"]["Update"],
): Promise<boolean> {
  let q = (await admin()).from("user_stats").update(patch).eq("user_id", userId);
  q = previous === null ? q.is(column, null) : q.eq(column, previous);
  const { data, error } = await q.select("user_id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
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
    const { data, error } = await (
      await admin()
    )
      .from("user_stats")
      .select(
        "total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day",
      )
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

/** Item ids the signed-in user has bought in the store. */
export const getMyInventory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const { data, error } = await (
      await admin()
    )
      .from("user_inventory")
      .select("item_id")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => r.item_id);
  });

export type PurchaseResponse =
  | { ok: true; total_points: number }
  | {
      ok: false;
      reason: "insufficient_coins" | "already_owned" | "not_found";
      total_points: number;
    };

/** Buy a store item: price comes from the catalog, debit and ownership are recorded in one transaction. */
export const purchaseStoreItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ item_id: z.string().max(60) }).parse(input))
  .handler(async ({ data, context }): Promise<PurchaseResponse> => {
    const item = STORE_CATALOG.find((i) => i.id === data.item_id);
    if (!item || item.vipOnly) {
      const stats = await readStats(context.userId).catch(() => null);
      return { ok: false, reason: "not_found", total_points: stats?.total_points ?? 0 };
    }
    const { data: rows, error } = await (
      await admin()
    ).rpc("purchase_item", {
      _user: context.userId,
      _item: item.id,
      _cost: item.cost,
    });
    if (error) throw new Error(error.message);
    const row = rows?.[0];
    const total = row?.out_total ?? 0;
    if (row?.out_status === "ok") {
      const { syncPeopleSoon } = await import("@/lib/backup.server");
      await syncPeopleSoon();
      return { ok: true, total_points: total };
    }
    return {
      ok: false,
      reason: row?.out_status === "already_owned" ? "already_owned" : "insufficient_coins",
      total_points: total,
    };
  });

/** Record that the user completed today's Daily Challenge. Idempotent per day. */
export const recordDailyChallenge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(
    async ({
      context,
    }): Promise<{ awarded: boolean; stats: StatsDTO; newlyUnlocked: string[] }> => {
      const t = today();
      const y = yesterday();

      await ensureStatsRow(context.userId);
      const existing = await readStats(context.userId);
      if (existing.last_daily_challenge_day === t) {
        return { awarded: false, stats: existing, newlyUnlocked: [] };
      }

      const nextStreak = existing.last_daily_challenge_day === y ? existing.current_streak + 1 : 1;
      const longest = Math.max(existing.longest_streak, nextStreak);
      const claimed = await claimDay(
        context.userId,
        "last_daily_challenge_day",
        existing.last_daily_challenge_day,
        {
          current_streak: nextStreak,
          longest_streak: longest,
          last_active_day: t,
          last_daily_challenge_day: t,
        },
      );
      if (!claimed) {
        return { awarded: false, stats: await readStats(context.userId), newlyUnlocked: [] };
      }

      const awardedPoints = await awardAmountForUser(context, DAILY_POINTS);
      await applyPoints(context.userId, awardedPoints);
      const row = await readStats(context.userId);

      await awardXp(context, "daily", awardedPoints);
      const newlyUnlocked = await checkAchievements(context, row);
      return { awarded: true, stats: row, newlyUnlocked };
    },
  );

/** Record that the user viewed/discovered a fact. Bumps facts_seen. */
export const recordDiscovery = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ fact_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ stats: StatsDTO; newlyUnlocked: string[] }> => {
    const db = await admin();
    // Only the first time a user sees a fact earns a point and counts toward facts_seen;
    // repeat views are still logged for the timeline.
    const { data: seenBefore } = await db
      .from("discoveries")
      .select("fact_id")
      .eq("user_id", context.userId)
      .eq("fact_id", data.fact_id)
      .limit(1);
    const firstTime = (seenBefore?.length ?? 0) === 0;

    await context.supabase
      .from("discoveries")
      .insert({ user_id: context.userId, fact_id: data.fact_id });

    await ensureStatsRow(context.userId);
    await db.from("user_stats").update({ last_active_day: today() }).eq("user_id", context.userId);

    if (!firstTime) {
      return { stats: await readStats(context.userId), newlyUnlocked: [] };
    }

    const { data: fact } = await context.supabase
      .from("facts")
      .select("category")
      .eq("id", data.fact_id)
      .maybeSingle();

    const DISCOVERY_POINTS_BASE = 1;
    const awardedPoints = await awardAmountForUser(context, DISCOVERY_POINTS_BASE);
    await applyPoints(context.userId, awardedPoints, 1);
    const row = await readStats(context.userId);

    await awardXp(
      context,
      "discovery",
      awardedPoints,
      (fact as { category: string | null } | null)?.category ?? null,
    );
    const newlyUnlocked = await checkAchievements(context, row);
    return { stats: row, newlyUnlocked };
  });

// -------------------- "But… Why?" chain rewards --------------------

const CHAIN_LAYER_POINTS_BASE = 3;
const CHAIN_REWARDS_PER_DAY = 30;
// The client waits 3s before claiming; allow a little clock slack.
const CHAIN_MIN_READ_MS = 2500;
const CHAIN_REWARD_TTL_MS = 60 * 60 * 1000;

export type ChainRewardResult =
  | { awarded: true; points: number; total_points: number }
  | { awarded: false; reason: "daily_cap" | "invalid"; points: 0; total_points: number };

/** Claim the coins for a chain layer issued by generateWhyLayer. Each layer pays once. */
export const claimChainLayerReward = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ reward_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ChainRewardResult> => {
    const db = await admin();
    const now = Date.now();

    const { count } = await db
      .from("chain_layer_rewards")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .gte("claimed_at", `${today()}T00:00:00Z`);
    if ((count ?? 0) >= CHAIN_REWARDS_PER_DAY) {
      await ensureStatsRow(context.userId);
      const stats = await readStats(context.userId);
      return { awarded: false, reason: "daily_cap", points: 0, total_points: stats.total_points };
    }

    // Compare-and-set: unclaimed, owned by the caller, old enough to have been read.
    const { data: claimed, error } = await db
      .from("chain_layer_rewards")
      .update({ claimed_at: new Date(now).toISOString() })
      .eq("id", data.reward_id)
      .eq("user_id", context.userId)
      .is("claimed_at", null)
      .lte("issued_at", new Date(now - CHAIN_MIN_READ_MS).toISOString())
      .gte("issued_at", new Date(now - CHAIN_REWARD_TTL_MS).toISOString())
      .select("id");
    if (error) throw new Error(error.message);
    if (!claimed || claimed.length === 0) {
      await ensureStatsRow(context.userId);
      const stats = await readStats(context.userId);
      return { awarded: false, reason: "invalid", points: 0, total_points: stats.total_points };
    }

    const points = await awardAmountForUser(context, CHAIN_LAYER_POINTS_BASE);
    const total = (await applyPoints(context.userId, points)) ?? 0;
    await awardXp(context, "chain", points);
    return { awarded: true, points, total_points: total };
  });

// -------------------- Account deletion --------------------

/**
 * Permanently delete the signed-in user's account. Required by Google Play
 * and the App Store. Active VIP billing is cancelled first so nobody keeps
 * paying for a deleted account; all user tables cascade from auth.users.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ confirm: z.literal("DELETE") }).parse(input))
  .handler(async ({ context }): Promise<{ ok: true }> => {
    const db = await admin();
    const { data: subs, error: subErr } = await db
      .from("subscriptions")
      .select("paddle_subscription_id, environment")
      .eq("user_id", context.userId)
      .in("status", ["active", "trialing", "past_due", "paused"]);
    if (subErr) throw new Error(subErr.message);
    if (subs && subs.length > 0) {
      const { getPaddleClient } = await import("@/lib/paddle.server");
      for (const sub of subs) {
        try {
          await getPaddleClient(
            sub.environment === "live" ? "live" : "sandbox",
          ).subscriptions.cancel(sub.paddle_subscription_id, { effectiveFrom: "immediately" });
        } catch (e) {
          console.error("[delete-account] couldn't cancel subscription", e);
          throw new Error(
            "We couldn't cancel your VIP subscription, so your account wasn't deleted. Please try again in a moment.",
          );
        }
      }
    }

    const { error } = await db.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
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
      const { error } = await context.supabase.from("favorites").delete().eq("id", existing.id);
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
      (await admin())
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
    context.supabase.from("why_chains").select("id, step_count").eq("user_id", context.userId),
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
  const discRows = (discCatRes.data ?? []) as unknown as Array<{
    facts: { category: string | null } | { category: string | null }[] | null;
  }>;
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

  const { data: already } = await (
    await admin()
  )
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", context.userId)
    .in("achievement_id", candidates);
  const have = new Set((already ?? []).map((r) => r.achievement_id));
  const toInsert = candidates.filter((id) => !have.has(id));
  if (toInsert.length === 0) return [];
  await (
    await admin()
  )
    .from("user_achievements")
    .insert(toInsert.map((id) => ({ user_id: context.userId, achievement_id: id })));
  return toInsert;
}

export async function runAchievementCheckForUser(context: AuthContext): Promise<string[]> {
  const { data: row } = await (
    await admin()
  )
    .from("user_stats")
    .select(
      "total_points, current_streak, longest_streak, facts_seen, last_active_day, last_daily_challenge_day, last_login_bonus_day",
    )
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
    const { data: existing } = await (
      await admin()
    )
      .from("user_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();

    if (!existing) {
      await (await admin()).from("user_stats").upsert(
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

    await ensureStatsRow(context.userId);
    const { data: existing, error: readErr } = await (
      await admin()
    )
      .from("user_stats")
      .select(`${STATS_COLS}, login_streak`)
      .eq("user_id", context.userId)
      .single();
    if (readErr) throw new Error(readErr.message);
    const { login_streak: prevLoginStreak, ...prevStats } = existing;

    if (existing.last_login_bonus_day === t) {
      return {
        claimed: false,
        awarded_points: 0,
        streak: prevLoginStreak ?? 0,
        stats: prevStats as StatsDTO,
        next_available_at: nextAvailable,
      };
    }

    // Login-bonus escalation uses its own login_streak. `current_streak`
    // belongs to the daily-challenge streak (see recordDailyChallenge).
    const loginStreak = existing.last_login_bonus_day === y ? (prevLoginStreak ?? 0) + 1 : 1;
    const claimed = await claimDay(
      context.userId,
      "last_login_bonus_day",
      existing.last_login_bonus_day,
      {
        last_login_bonus_day: t,
        login_streak: loginStreak,
        last_active_day: t,
      },
    );
    if (!claimed) {
      return {
        claimed: false,
        awarded_points: 0,
        streak: prevLoginStreak ?? 0,
        stats: await readStats(context.userId),
        next_available_at: nextAvailable,
      };
    }

    const baseBonus = Math.min(
      LOGIN_BONUS_MAX,
      LOGIN_BONUS_BASE + (loginStreak - 1) * LOGIN_BONUS_STREAK_STEP,
    );
    const bonus = await awardAmountForUser(context, baseBonus);
    await applyPoints(context.userId, bonus);
    const row = await readStats(context.userId);

    await awardXp(context, "login", bonus);
    await checkAchievements(context, row);
    return {
      claimed: true,
      awarded_points: bonus,
      streak: loginStreak,
      stats: row,
      next_available_at: nextAvailable,
    };
  });
