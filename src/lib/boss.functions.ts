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

async function writeAudit(
  admin: any,
  actorId: string,
  action: string,
  targetUserId: string | null,
  details: Record<string, unknown>,
) {
  await admin
    .from("boss_audit_log")
    .insert({ actor_id: actorId, action, target_user_id: targetUserId, details });
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
    await writeAudit(supabaseAdmin, context.userId, "adjust_balance", data.userId, {
      previous: current,
      next,
      delta: data.delta ?? null,
      set_to: data.setTo ?? null,
    });
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
    const { data: prevSubs } = await supabaseAdmin
      .from("subscriptions")
      .select("status, current_period_end")
      .eq("user_id", data.userId)
      .in("status", ["active", "trialing"])
      .limit(1);
    const wasVip = (prevSubs ?? []).length > 0;
    const prevPeriodEnd = prevSubs?.[0]?.current_period_end ?? null;
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
      await writeAudit(supabaseAdmin, context.userId, "grant_vip", data.userId, {
        previous: { is_vip: wasVip, period_end: prevPeriodEnd },
        next: { is_vip: true, period_end: periodEnd },
        days: data.days ?? 30,
      });
      return { ok: true, is_vip: true };
    }
    const { error } = await supabaseAdmin
      .from("subscriptions")
      .update({ status: "canceled", cancel_at_period_end: true })
      .eq("user_id", data.userId)
      .in("status", ["active", "trialing"]);
    if (error) throw new Error(error.message);
    await writeAudit(supabaseAdmin, context.userId, "revoke_vip", data.userId, {
      previous: { is_vip: wasVip, period_end: prevPeriodEnd },
      next: { is_vip: false },
    });
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
    const { data: prev } = await context.supabase
      .from("app_config")
      .select("value")
      .eq("key", "privileges")
      .maybeSingle();
    const { error } = await context.supabase
      .from("app_config")
      .upsert(
        { key: "privileges", value: data, updated_at: new Date().toISOString(), updated_by: context.userId },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeAudit(supabaseAdmin, context.userId, "update_privileges", null, {
      previous: prev?.value ?? null,
      next: data,
    });
    return { ok: true };
  });

export const bossAmIBoss = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase.rpc("is_boss", { _uid: context.userId });
    return { isBoss: !!data };
  });

export type AuditEntry = {
  id: string;
  actor_id: string;
  target_user_id: string | null;
  action: string;
  details: any;
  created_at: string;
  target_email: string | null;
};

export type AuditEntryWithActor = AuditEntry & { actor_email: string | null };

export const bossListAudit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    limit?: number;
    action?: string;
    email?: string;
    from?: string;
    to?: string;
  }) => ({
    limit: Math.min(Math.max(d.limit ?? 100, 1), 1000),
    action: d.action?.trim() || undefined,
    email: d.email?.trim().toLowerCase() || undefined,
    from: d.from || undefined,
    to: d.to || undefined,
  }))
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("boss_audit_log")
      .select("id, actor_id, target_user_id, action, details, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit);
    if (data.action) q = q.eq("action", data.action);
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    const { data: users } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const emailMap = new Map<string, string | null>();
    for (const u of users?.users ?? []) emailMap.set(u.id, u.email ?? null);

    let entries = (rows ?? []).map((r: any) => ({
      ...r,
      target_email: r.target_user_id ? emailMap.get(r.target_user_id) ?? null : null,
      actor_email: emailMap.get(r.actor_id) ?? null,
    })) as AuditEntryWithActor[];
    if (data.email) {
      entries = entries.filter((e) => (e.target_email ?? "").toLowerCase().includes(data.email!));
    }
    return { entries };
  });

// ---------- Guest sign-up popup timer ----------

const GUEST_PROMPT_KEY = "guest_prompt_seconds";
const GUEST_PROMPT_DEFAULT = 5;

/**
 * Public read: returns how long (in seconds) the guest sign-up popup should
 * lock its close button. Falls back to the default if unset. No auth so
 * anonymous visitors can fetch the current value.
 */
export const getGuestPromptSeconds = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data } = await supabaseAdmin
        .from("app_config")
        .select("value")
        .eq("key", GUEST_PROMPT_KEY)
        .maybeSingle();
      const raw = (data?.value as { seconds?: number } | null)?.seconds;
      const n = typeof raw === "number" && Number.isFinite(raw) ? raw : GUEST_PROMPT_DEFAULT;
      return { seconds: Math.max(0, Math.min(60, Math.round(n))) };
    } catch {
      return { seconds: GUEST_PROMPT_DEFAULT };
    }
  });

export const bossSetGuestPromptSeconds = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { seconds: number }) =>
    z.object({ seconds: z.number().int().min(0).max(60) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertBoss(context);
    const { error } = await context.supabase
      .from("app_config")
      .upsert(
        {
          key: GUEST_PROMPT_KEY,
          value: { seconds: data.seconds },
          updated_at: new Date().toISOString(),
          updated_by: context.userId,
        },
        { onConflict: "key" },
      );
    if (error) throw new Error(error.message);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await writeAudit(supabaseAdmin, context.userId, "update_guest_prompt", null, {
      seconds: data.seconds,
    });
    return { ok: true };
  });


// -------------------- Bulk import questions from Google Sheets --------------------
//
// Reads a range from a Google Sheet (via the connector gateway) and inserts rows
// into public.facts. Expected header row (case-insensitive):
//   question | answer | fun_fact | category
// Extra columns like "code" or "created" are ignored. Missing category falls back
// to the tab name (lower-cased) when it matches a known CategoryKey.

const CATS = new Set([
  "animals","space","earth","science","body","weather","food","history","technology","ocean","dinosaurs",
]);

async function fetchSheetRows(spreadsheetId: string, range: string): Promise<string[][]> {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) throw new Error("Google Sheets connector not configured");
  const url = `https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets/${spreadsheetId}/values/${range}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey },
  });
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`);
  const body = (await res.json()) as { values?: string[][] };
  return body.values ?? [];
}

export type BulkImportResult = {
  inserted: number;
  skipped: number;
  errors: { row: number; reason: string }[];
};

export const bossBulkImportFromSheet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { spreadsheetId?: string; range?: string; defaultCategory?: string; dryRun?: boolean }) => ({
    spreadsheetId: (d.spreadsheetId ?? process.env.WHY_SHEET_ID ?? "").trim(),
    range: (d.range ?? "Sheet1!A1:Z1000").trim(),
    defaultCategory: (d.defaultCategory ?? "").trim().toLowerCase(),
    dryRun: !!d.dryRun,
  }))
  .handler(async ({ data, context }): Promise<BulkImportResult> => {
    await assertBoss(context);
    if (!data.spreadsheetId) throw new Error("Missing spreadsheetId");

    const rows = await fetchSheetRows(data.spreadsheetId, data.range);
    if (rows.length < 2) return { inserted: 0, skipped: 0, errors: [{ row: 0, reason: "No data rows" }] };

    const header = rows[0].map((h) => h.trim().toLowerCase());
    const idx = {
      question: header.findIndex((h) => h === "question" || h === "q"),
      answer: header.findIndex((h) => h === "answer" || h === "a"),
      fun: header.findIndex((h) => h === "fun_fact" || h === "fun fact" || h === "fun"),
      cat: header.findIndex((h) => h === "category" || h === "cat"),
    };
    if (idx.question < 0 || idx.answer < 0) {
      throw new Error("Sheet must have 'question' and 'answer' columns");
    }

    // Tab name from range (before !) as category fallback
    const tabName = data.range.split("!")[0].replace(/^'|'$/g, "").trim().toLowerCase();
    const tabCat = CATS.has(tabName) ? tabName : null;
    const fallbackCat = CATS.has(data.defaultCategory) ? data.defaultCategory : tabCat;

    const { normalizeStoredQuestion } = await import("@/lib/normalizeQuestion");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const result: BulkImportResult = { inserted: 0, skipped: 0, errors: [] };
    const toInsert: { question: string; answer: string; fun_fact: string | null; category: string | null }[] = [];

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      const rawQ = (r[idx.question] ?? "").trim();
      const rawA = (r[idx.answer] ?? "").trim();
      const fun = idx.fun >= 0 ? (r[idx.fun] ?? "").trim() : "";
      const catRaw = idx.cat >= 0 ? (r[idx.cat] ?? "").trim().toLowerCase() : "";
      const category = CATS.has(catRaw) ? catRaw : fallbackCat;

      if (!rawQ || !rawA) {
        result.skipped++;
        continue;
      }
      const norm = normalizeStoredQuestion(rawQ);
      if (!norm.ok) {
        result.errors.push({ row: rowNum, reason: norm.reason ?? "grammar" });
        continue;
      }
      // Dedupe against existing question text
      const { data: existing } = await supabaseAdmin
        .from("facts")
        .select("id")
        .ilike("question", norm.question)
        .limit(1)
        .maybeSingle();
      if (existing) {
        result.skipped++;
        continue;
      }
      toInsert.push({ question: norm.question, answer: rawA, fun_fact: fun || null, category });
    }

    if (data.dryRun) {
      return { inserted: toInsert.length, skipped: result.skipped, errors: result.errors };
    }

    // Insert in small batches so partial failures still make progress.
    const CHUNK = 25;
    for (let i = 0; i < toInsert.length; i += CHUNK) {
      const batch = toInsert.slice(i, i + CHUNK);
      const { data: rows2, error } = await supabaseAdmin
        .from("facts")
        .insert(batch)
        .select("id");
      if (error) {
        result.errors.push({ row: -1, reason: error.message });
        continue;
      }
      result.inserted += rows2?.length ?? 0;
    }

    await writeAudit(supabaseAdmin, context.userId, "bulk_import_facts", null, {
      spreadsheetId: data.spreadsheetId,
      range: data.range,
      inserted: result.inserted,
      skipped: result.skipped,
      errors: result.errors.length,
    });

    return result;
  });
