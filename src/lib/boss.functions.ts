// Boss-only dev dashboard server functions.
// Every handler re-verifies the caller is the Boss account via public.is_boss(auth.uid()).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertBoss(ctx: { supabase: any; userId: string }) {
  const { data, error } = await ctx.supabase.rpc("is_boss", { _uid: ctx.userId });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type BossUserRow = {
  id: string;
  email: string | null;
  display_name: string | null;
  username: string | null;
  total_points: number;
  is_vip: boolean;
  created_at: string | null;
};

export const bossListUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { search?: string; limit?: number }) => ({
    search: (d.search ?? "").trim().slice(0, 120),
    limit: Math.min(Math.max(d.limit ?? 25, 1), 100),
  }))
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: users, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const term = data.search.toLowerCase();
    const filtered = (users?.users ?? [])
      .filter((u) => !term || (u.email ?? "").toLowerCase().includes(term))
      .slice(0, data.limit);
    const ids = filtered.map((u) => u.id);
    if (ids.length === 0) return { users: [] as BossUserRow[] };

    const [profilesRes, statsRes, subsRes] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, display_name, username").in("id", ids),
      supabaseAdmin.from("user_stats").select("user_id, total_points").in("user_id", ids),
      supabaseAdmin
        .from("subscriptions")
        .select("user_id, status, current_period_end")
        .in("user_id", ids)
        .in("status", ["active", "trialing"]),
    ]);

    const pMap = new Map((profilesRes.data ?? []).map((p: any) => [p.id, p]));
    const sMap = new Map((statsRes.data ?? []).map((s: any) => [s.user_id, s.total_points]));
    const vipSet = new Set(
      (subsRes.data ?? [])
        .filter((s: any) => !s.current_period_end || new Date(s.current_period_end) > new Date())
        .map((s: any) => s.user_id),
    );

    const rows: BossUserRow[] = filtered.map((u) => {
      const p: any = pMap.get(u.id);
      return {
        id: u.id,
        email: u.email ?? null,
        display_name: p?.display_name ?? null,
        username: p?.username ?? null,
        total_points: sMap.get(u.id) ?? 0,
        is_vip: vipSet.has(u.id),
        created_at: u.created_at ?? null,
      };
    });
    return { users: rows };
  });

export const bossAdjustBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta?: number; setTo?: number }) =>
    z
      .object({
        userId: z.string().uuid(),
        delta: z.number().int().optional(),
        setTo: z.number().int().min(0).optional(),
      })
      .refine((v) => v.delta !== undefined || v.setTo !== undefined, "Provide delta or setTo")
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("user_stats")
      .select("total_points")
      .eq("user_id", data.userId)
      .maybeSingle();
    const current = existing?.total_points ?? 0;
    const next =
      data.setTo !== undefined ? data.setTo : Math.max(0, current + (data.delta ?? 0));
    const { error } = await supabaseAdmin
      .from("user_stats")
      .upsert({ user_id: data.userId, total_points: next }, { onConflict: "user_id" });
    if (error) throw new Error(error.message);
    return { ok: true, total_points: next };
  });

export const bossSetVip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; grant: boolean; days?: number }) =>
    z
      .object({
        userId: z.string().uuid(),
        grant: z.boolean(),
        days: z.number().int().min(1).max(3650).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.grant) {
      const periodEnd = new Date(Date.now() + (data.days ?? 30) * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabaseAdmin.from("subscriptions").upsert(
        {
          user_id: data.userId,
          paddle_subscription_id: `boss_grant_${data.userId}`,
          paddle_customer_id: `boss_grant_${data.userId}`,
          product_id: "boss_grant",
          price_id: "boss_grant",
          status: "active",
          current_period_start: new Date().toISOString(),
          current_period_end: periodEnd,
          environment: "live",
          signup_bonus_awarded: true,
        },
        { onConflict: "paddle_subscription_id" },
      );

      if (error) throw new Error(error.message);
      return { ok: true, is_vip: true };
    }
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at_period_end: true })
      .eq("user_id", data.userId)
      .in("status", ["active", "trialing"]);
    if (error) throw new Error(error.message);
    return { ok: true, is_vip: false };
  });

export type Privileges = {
  free: { daily_facts_limit: number; quiz_daily_limit: number; coin_multiplier: number; ads_enabled: boolean };
  vip: { daily_facts_limit: number; quiz_daily_limit: number; coin_multiplier: number; ads_enabled: boolean };
};

export const bossGetPrivileges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertBoss(context);
    const { data, error } = await context.supabase
      .from("app_config")
      .select("value")
      .eq("key", "privileges")
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data?.value ?? null) as Privileges | null;
  });

export const bossUpdatePrivileges = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: Privileges) =>
    z
      .object({
        free: z.object({
          daily_facts_limit: z.number().int().min(0),
          quiz_daily_limit: z.number().int().min(0),
          coin_multiplier: z.number().min(0),
          ads_enabled: z.boolean(),
        }),
        vip: z.object({
          daily_facts_limit: z.number().int().min(0),
          quiz_daily_limit: z.number().int().min(0),
          coin_multiplier: z.number().min(0),
          ads_enabled: z.boolean(),
        }),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { error } = await context.supabase
      .from("app_config")
      .upsert(
        { key: "privileges", value: data, updated_at: new Date().toISOString(), updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const bossAmIBoss = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_boss", { _uid: context.userId });
    return { isBoss: !!data };
  });
