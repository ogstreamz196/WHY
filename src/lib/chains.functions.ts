// Server functions for saved Why chains, collections, category interests,
// discovery timeline. All user-scoped via requireSupabaseAuth.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runAchievementCheckForUser } from "./account.functions";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

function makeSlug(): string {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}

// ---------- Types ----------

export type ChainStep = {
  id: string;
  position: number;
  question: string;
  answer: string | null;
};

export type ChainSummary = {
  id: string;
  title: string | null;
  root_fact_id: string | null;
  is_public: boolean;
  share_slug: string | null;
  pinned: boolean;
  step_count: number;
  updated_at: string;
  last_question: string | null;
};

export type ChainDetail = {
  id: string;
  title: string | null;
  root_fact_id: string | null;
  is_public: boolean;
  share_slug: string | null;
  pinned: boolean;
  updated_at: string;
  steps: ChainStep[];
};

export type PublicChain = {
  id: string;
  title: string | null;
  share_slug: string;
  updated_at: string;
  steps: ChainStep[];
  owner: { display_name: string | null; avatar_id: string | null } | null;
};

// ---------- Save / list / get / delete ----------

const StepSchema = z.object({
  question: z.string().trim().min(1).max(500),
  answer: z.string().trim().max(2000).optional().nullable(),
});

export type ChampionClaim = {
  claimed: boolean;
  title_key: string;
  value: number;
  previous_value: number;
  previous_holder_id: string | null;
  previous_holder_name: string | null;
};

export const saveChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        title: z.string().trim().min(1).max(120),
        root_fact_id: z.string().uuid().optional().nullable(),
        steps: z.array(StepSchema).min(1).max(20),
      })
      .parse(input),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ id: string; newlyUnlocked: string[]; champion: ChampionClaim | null }> => {
      const { data: chain, error } = await context.supabase
        .from("why_chains")
        .insert({
          user_id: context.userId,
          title: data.title,
          root_fact_id: data.root_fact_id ?? null,
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      const rows = data.steps.map((s, i) => ({
        chain_id: chain.id,
        user_id: context.userId,
        position: i,
        question: s.question,
        answer: s.answer ?? null,
      }));
      const { error: stepsErr } = await context.supabase.from("why_chain_steps").insert(rows);
      if (stepsErr) throw new Error(stepsErr.message);
      const newlyUnlocked = await runAchievementCheckForUser(context);

      // Claim the "longest chain" champion title if this chain sets a new record.
      let champion: ChampionClaim | null = null;
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: claim } = await supabaseAdmin.rpc("claim_champion_title", {
          _title: "longest_chain",
          _user: context.userId,
          _value: data.steps.length,
          _ref: chain.id,
        });
        const row = Array.isArray(claim) ? claim[0] : claim;
        if (row) {
          let prevName: string | null = null;
          if (row.previous_holder) {
            const { data: prof } = await supabaseAdmin
              .from("profiles")
              .select("display_name")
              .eq("id", row.previous_holder)
              .maybeSingle();
            prevName = prof?.display_name ?? null;
          }
          champion = {
            claimed: !!row.claimed,
            title_key: "longest_chain",
            value: row.current_value ?? data.steps.length,
            previous_value: row.previous_value ?? 0,
            previous_holder_id: row.previous_holder ?? null,
            previous_holder_name: prevName,
          };
        }
      } catch (e) {
        console.warn("champion claim failed", e);
      }

      return { id: chain.id, newlyUnlocked, champion };
    },
  );

export const getChampionTitle = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ title_key: z.string().min(1).max(64).default("longest_chain") }).parse(input ?? {}),
  )
  .handler(async ({ data }) => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: row } = await sb
      .from("champion_titles")
      .select("*")
      .eq("title_key", data.title_key)
      .maybeSingle();
    if (!row) return null;
    let holder: { id: string; display_name: string | null; avatar_id: string | null } | null = null;
    if (row.holder_user_id) {
      const { data: prof } = await sb
        .from("profiles")
        .select("id, display_name, avatar_id")
        .eq("id", row.holder_user_id)
        .maybeSingle();
      holder = prof ?? null;
    }
    return {
      title_key: row.title_key,
      record_value: row.record_value,
      claimed_at: row.claimed_at,
      holder,
    };
  });

export const listMyChains = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        offset: z.number().int().min(0).max(10_000).default(0),
        limit: z.number().int().min(1).max(50).default(100),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ items: ChainSummary[]; hasMore: boolean; nextOffset: number }> => {
      const from = data.offset;
      const to = data.offset + data.limit - 1;
      const {
        data: chains,
        error,
        count,
      } = await context.supabase
        .from("why_chains")
        .select("id, title, root_fact_id, is_public, share_slug, pinned, updated_at", {
          count: "exact",
        })
        .eq("user_id", context.userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      const rows = chains ?? [];
      if (!rows.length) {
        return { items: [], hasMore: false, nextOffset: data.offset };
      }
      const ids = rows.map((c) => c.id);
      const { data: steps } = await context.supabase
        .from("why_chain_steps")
        .select("chain_id, question, position")
        .in("chain_id", ids)
        .order("position", { ascending: false });
      const lastByChain = new Map<string, { q: string; count: number }>();
      (steps ?? []).forEach((s) => {
        const prev = lastByChain.get(s.chain_id);
        if (!prev) lastByChain.set(s.chain_id, { q: s.question, count: 1 });
        else lastByChain.set(s.chain_id, { q: prev.q, count: prev.count + 1 });
      });
      const items = rows.map((c) => {
        const meta = lastByChain.get(c.id);
        return {
          ...c,
          step_count: meta?.count ?? 0,
          last_question: meta?.q ?? null,
        } as ChainSummary;
      });
      const total = count ?? data.offset + items.length;
      return {
        items,
        hasMore: data.offset + items.length < total,
        nextOffset: data.offset + items.length,
      };
    },
  );

export const getChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ChainDetail | null> => {
    const { data: chain } = await context.supabase
      .from("why_chains")
      .select("id, title, root_fact_id, is_public, share_slug, pinned, updated_at")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!chain) return null;
    const { data: steps } = await context.supabase
      .from("why_chain_steps")
      .select("id, position, question, answer")
      .eq("chain_id", chain.id)
      .order("position", { ascending: true });
    return { ...chain, steps: (steps ?? []) as ChainStep[] };
  });

export const resumeLastChain = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ChainSummary | null> => {
    const { data: chain } = await context.supabase
      .from("why_chains")
      .select("id, title, root_fact_id, is_public, share_slug, pinned, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!chain) return null;
    const { data: steps } = await context.supabase
      .from("why_chain_steps")
      .select("question, position")
      .eq("chain_id", chain.id)
      .order("position", { ascending: false })
      .limit(1);
    const { count } = await context.supabase
      .from("why_chain_steps")
      .select("id", { count: "exact", head: true })
      .eq("chain_id", chain.id);
    return {
      ...chain,
      step_count: count ?? 0,
      last_question: steps?.[0]?.question ?? null,
    };
  });

export const deleteChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("why_chains")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const setChainShared = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), is_public: z.boolean() }).parse(input),
  )
  .handler(
    async ({ data, context }): Promise<{ share_slug: string | null; is_public: boolean }> => {
      const patch: { is_public: boolean; share_slug?: string | null } = {
        is_public: data.is_public,
      };
      if (data.is_public) {
        const { data: existing } = await context.supabase
          .from("why_chains")
          .select("share_slug")
          .eq("id", data.id)
          .eq("user_id", context.userId)
          .maybeSingle();
        if (!existing) throw new Error("Not found");
        if (!existing.share_slug) patch.share_slug = makeSlug();
      }
      const { data: row, error } = await context.supabase
        .from("why_chains")
        .update(patch)
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("share_slug, is_public")
        .single();
      if (error) throw new Error(error.message);
      return row;
    },
  );

export const togglePinChain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid(), pinned: z.boolean() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("why_chains")
      .update({ pinned: data.pinned })
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- Public share ----------

export const getPublicChain = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(3).max(40) }).parse(input))
  .handler(async ({ data }): Promise<PublicChain | null> => {
    const sb = createClient<Database>(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
    );
    const { data: chain } = await sb
      .from("why_chains")
      .select("id, user_id, title, share_slug, updated_at, is_public")
      .eq("share_slug", data.slug)
      .eq("is_public", true)
      .maybeSingle();
    if (!chain) return null;
    const [{ data: steps }, { data: owner }] = await Promise.all([
      sb
        .from("why_chain_steps")
        .select("id, position, question, answer")
        .eq("chain_id", chain.id)
        .order("position", { ascending: true }),
      sb
        .from("profiles_public")
        .select("display_name, avatar_id")
        .eq("id", chain.user_id)
        .maybeSingle(),
    ]);
    return {
      id: chain.id,
      title: chain.title,
      share_slug: chain.share_slug!,
      updated_at: chain.updated_at,
      steps: (steps ?? []) as ChainStep[],
      owner: owner ?? null,
    };
  });

// ---------- Collections ----------

export type CollectionSummary = {
  id: string;
  name: string;
  description: string | null;
  chain_count: number;
  updated_at: string;
};

export const listCollections = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CollectionSummary[]> => {
    const { data: cols, error } = await context.supabase
      .from("chain_collections")
      .select("id, name, description, updated_at")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    if (!cols?.length) return [];
    const { data: items } = await context.supabase
      .from("chain_collection_items")
      .select("collection_id")
      .in(
        "collection_id",
        cols.map((c) => c.id),
      );
    const counts = new Map<string, number>();
    (items ?? []).forEach((r) =>
      counts.set(r.collection_id, (counts.get(r.collection_id) ?? 0) + 1),
    );
    return cols.map((c) => ({ ...c, chain_count: counts.get(c.id) ?? 0 }));
  });

export const createCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(80),
        description: z.string().trim().max(280).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ id: string }> => {
    const { data: row, error } = await context.supabase
      .from("chain_collections")
      .insert({ user_id: context.userId, name: data.name, description: data.description ?? null })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const addChainToCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ collection_id: z.string().uuid(), chain_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("chain_collection_items").upsert(
      {
        collection_id: data.collection_id,
        chain_id: data.chain_id,
        user_id: context.userId,
      },
      { onConflict: "collection_id,chain_id", ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const removeChainFromCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ collection_id: z.string().uuid(), chain_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chain_collection_items")
      .delete()
      .eq("collection_id", data.collection_id)
      .eq("chain_id", data.chain_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const deleteCollection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("chain_collections")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

// ---------- Category interests ----------

export type CategoryInterest = {
  category: string;
  weight: number;
  last_engaged_at: string;
};

export const bumpCategoryInterest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().trim().min(1).max(40),
        delta: z.number().int().min(1).max(20).default(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: existing } = await context.supabase
      .from("category_interests")
      .select("weight")
      .eq("user_id", context.userId)
      .eq("category", data.category)
      .maybeSingle();
    const nextWeight = (existing?.weight ?? 0) + data.delta;
    const { error } = await context.supabase.from("category_interests").upsert(
      {
        user_id: context.userId,
        category: data.category,
        weight: nextWeight,
        last_engaged_at: new Date().toISOString(),
      },
      { onConflict: "user_id,category" },
    );
    if (error) throw new Error(error.message);
    const newlyUnlocked = await runAchievementCheckForUser(context);
    return { ok: true as const, weight: nextWeight, newlyUnlocked };
  });

export const getCategoryInterests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CategoryInterest[]> => {
    const { data, error } = await context.supabase
      .from("category_interests")
      .select("category, weight, last_engaged_at")
      .eq("user_id", context.userId)
      .order("weight", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []) as CategoryInterest[];
  });

// ---------- Discovery timeline ----------

export type TimelineEntry = {
  seen_at: string;
  fact: {
    id: string;
    question: string;
    category: string | null;
  };
};

export const getDiscoveryTimeline = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(100).default(30),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(
    async ({
      data,
      context,
    }): Promise<{ items: TimelineEntry[]; hasMore: boolean; nextOffset: number }> => {
      const from = data.offset;
      const to = data.offset + data.limit - 1;
      const { data: rows, error } = await context.supabase
        .from("discoveries")
        .select("seen_at, facts:fact_id (id, question, category)")
        .eq("user_id", context.userId)
        .order("seen_at", { ascending: false })
        .range(from, to);
      if (error) throw new Error(error.message);
      const items = (
        (rows ?? []) as Array<{ seen_at: string; facts: TimelineEntry["fact"] | null }>
      )
        .filter((r) => r.facts !== null)
        .map((r) => ({ seen_at: r.seen_at, fact: r.facts! }));
      return {
        items,
        hasMore: items.length === data.limit,
        nextOffset: data.offset + items.length,
      };
    },
  );

// ---------- Share slug regeneration ----------

export const regenerateChainSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<{ share_slug: string }> => {
    // Try a few times in case of unique collision
    for (let attempt = 0; attempt < 5; attempt++) {
      const newSlug = makeSlug();
      const { data: row, error } = await context.supabase
        .from("why_chains")
        .update({ share_slug: newSlug })
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .select("share_slug")
        .maybeSingle();
      if (!error && row?.share_slug) return { share_slug: row.share_slug };
    }
    throw new Error("Could not regenerate share link");
  });
