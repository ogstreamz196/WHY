// Adult (18+) mode: age verification via Google/Apple, and adult fact feed.
// Verification is proof of an identity provider — the user attests they're 18+
// AND is signed in with a verified Google or Apple account. This isn't a
// legal ID check, but it's the same bar used across most consumer apps.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdultStatus = {
  verified: boolean;
  provider: string | null;
  verified_at: string | null;
  mode_enabled: boolean;
};

export type AdultFact = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  fun_fact: string | null;
};

const APPROVED_PROVIDERS = new Set(["google", "apple"]);

async function readProviders(supabase: import("@supabase/supabase-js").SupabaseClient) {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return [] as string[];
  const identities = (data.user.identities ?? []).map((i) => i.provider);
  const meta = (data.user.app_metadata?.providers as string[] | undefined) ?? [];
  const primary = (data.user.app_metadata?.provider as string | undefined) ?? null;
  return Array.from(new Set([...identities, ...meta, ...(primary ? [primary] : [])]));
}

export const getAdultStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdultStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: profile }, { data: settings }] = await Promise.all([
      supabaseAdmin
        .from("profiles")
        .select("adult_verified_at, adult_provider")
        .eq("id", context.userId)
        .maybeSingle(),
      context.supabase
        .from("user_settings")
        .select("adult_mode_enabled")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const p = (profile ?? {}) as { adult_verified_at?: string | null; adult_provider?: string | null };
    const s = (settings ?? {}) as { adult_mode_enabled?: boolean };
    return {
      verified: !!p.adult_verified_at,
      provider: p.adult_provider ?? null,
      verified_at: p.adult_verified_at ?? null,
      mode_enabled: !!s.adult_mode_enabled,
    };
  });

export const verifyAdult = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ confirm_over_18: z.literal(true) }).parse(input),
  )
  .handler(async ({ context }): Promise<AdultStatus> => {
    const providers = await readProviders(context.supabase);
    const matched = providers.find((p) => APPROVED_PROVIDERS.has(p));
    if (!matched) {
      throw new Error(
        "Age verification requires a Google or Apple sign-in. Please link one from Sign in.",
      );
    }
    const now = new Date().toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ adult_verified_at: now, adult_provider: matched })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, adult_mode_enabled: true }, { onConflict: "user_id" });
    return {
      verified: true,
      provider: matched,
      verified_at: now,
      mode_enabled: true,
    };
  });

export const setAdultMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ enabled: z.boolean() }).parse(input))
  .handler(async ({ data, context }): Promise<{ mode_enabled: boolean }> => {
    const { error } = await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, adult_mode_enabled: data.enabled }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { mode_enabled: data.enabled };
  });

export const revokeAdultVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdultStatus> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ adult_verified_at: null, adult_provider: null })
      .eq("id", context.userId);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("user_settings")
      .upsert({ user_id: context.userId, adult_mode_enabled: false }, { onConflict: "user_id" });
    return { verified: false, provider: null, verified_at: null, mode_enabled: false };
  });

// Adult facts feed — RLS ensures only verified users receive is_adult=true rows.
export const listAdultFacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).default(10),
        offset: z.number().int().min(0).max(10_000).default(0),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<{ items: AdultFact[]; hasMore: boolean; nextOffset: number }> => {
    const from = data.offset;
    const to = data.offset + data.limit - 1;
    const { data: rows, error } = await context.supabase
      .from("facts")
      .select("id, question, answer, category, fun_fact, is_adult")
      .eq("is_adult", true)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw new Error(error.message);
    const items = (rows ?? []) as AdultFact[];
    return {
      items,
      hasMore: items.length === data.limit,
      nextOffset: data.offset + items.length,
    };
  });
