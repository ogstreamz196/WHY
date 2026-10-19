// 18+ mode: crude, gross and funny facts plus the "OG" chat bot, for adults
// on the website only. Every call checks, on the server:
//   1. the request isn't from the Android/iOS app (store rules, young users),
//   2. the account's saved birth date makes them 18 or over,
//   3. (for content) they've switched 18+ mode on.
// Adult facts live in public.adult_facts, which only the server can read, so
// they can never reach the kids' feed. See docs/ADULT_MODE.md.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  birthDateFromMeta,
  isAdultBirthDate,
  isNativeUserAgent,
  isPlausibleBirthDate,
  isUnderAccountAge,
} from "./adultGate";

type AuthCtx = {
  userId: string;
  supabase: import("@supabase/supabase-js").SupabaseClient;
};

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function fromNativeApp(): Promise<boolean> {
  const { getRequest } = await import("@tanstack/react-start/server");
  return isNativeUserAgent(getRequest()?.headers.get("user-agent"));
}

/**
 * The account as stored by Supabase Auth. Read with the service role by id:
 * the request's own client has no stored session, so auth.getUser() there
 * always came back empty (birthdays looked unsaved and saving failed).
 */
async function accountUser(userId: string) {
  const { data, error } = await (await admin()).auth.admin.getUserById(userId);
  if (error) throw new Error(error.message);
  return data.user;
}

async function savedBirthDate(ctx: AuthCtx) {
  return birthDateFromMeta((await accountUser(ctx.userId))?.app_metadata);
}

async function readMode(userId: string) {
  const db = await admin();
  const [{ data: profile }, { data: settings }] = await Promise.all([
    db.from("profiles").select("adult_verified_at").eq("id", userId).maybeSingle(),
    db.from("user_settings").select("adult_mode_enabled").eq("user_id", userId).maybeSingle(),
  ]);
  return {
    confirmed: !!profile?.adult_verified_at,
    enabled: !!settings?.adult_mode_enabled,
  };
}

class AdultGateError extends Error {}

/** Throws unless this player may see 18+ content right now. */
async function requireAdultMode(ctx: AuthCtx): Promise<void> {
  if (await fromNativeApp()) throw new AdultGateError("18+ mode isn't available in the app.");
  if (!isAdultBirthDate(await savedBirthDate(ctx))) {
    throw new AdultGateError("This area is for adults only.");
  }
  const mode = await readMode(ctx.userId);
  if (!mode.confirmed || !mode.enabled) throw new AdultGateError("Switch on 18+ mode first.");
}

// -------------------- Status, birthday and the switch --------------------

export type AdultStatus = {
  /** Whether a birthday is saved on the account (asked once, neutrally, in Settings). */
  birthdate_known: boolean;
  /** 18+ by saved birthday and on the website: the switch may be shown. */
  available: boolean;
  /** 18+ mode switched on. */
  mode_enabled: boolean;
  /** The saved birthday is under 13, the minimum age for an account. */
  under_13: boolean;
};

export const getAdultStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdultStatus> => {
    const birth = await savedBirthDate(context);
    const available = !(await fromNativeApp()) && isAdultBirthDate(birth);
    const mode = available ? await readMode(context.userId) : { confirmed: false, enabled: false };
    return {
      birthdate_known: !!birth,
      available,
      mode_enabled: available && mode.confirmed && mode.enabled,
      under_13: isUnderAccountAge(birth),
    };
  });

/** Save the player's birth month and year. Once saved it can't be changed. */
export const saveMyBirthDate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ year: z.number().int(), month: z.number().int().min(1).max(12) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ ok: true } | { ok: false; error: string }> => {
    if (!isPlausibleBirthDate(data)) return { ok: false, error: "Please pick a real date." };
    const user = await accountUser(context.userId).catch(() => null);
    if (!user) return { ok: false, error: "Please sign in again." };
    if (birthDateFromMeta(user.app_metadata)) {
      return { ok: false, error: "Your birthday is already saved." };
    }
    const { error } = await (
      await admin()
    ).auth.admin.updateUserById(context.userId, {
      app_metadata: { ...user.app_metadata, birth_year: data.year, birth_month: data.month },
    });
    if (error) return { ok: false, error: "Couldn't save that. Please try again." };
    return { ok: true };
  });

/**
 * Switch 18+ mode on or off. Switching on needs an 18+ birthday, the website,
 * and (the first time) the player's confirmation of the content warning.
 */
export const setAdultMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ enabled: z.boolean(), confirm_over_18: z.boolean().optional() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ mode_enabled: boolean }> => {
    const db = await admin();
    if (data.enabled) {
      if (await fromNativeApp()) throw new Error("18+ mode isn't available in the app.");
      if (!isAdultBirthDate(await savedBirthDate(context))) {
        throw new Error("This area is for adults only.");
      }
      const mode = await readMode(context.userId);
      if (!mode.confirmed) {
        if (!data.confirm_over_18) throw new Error("Please confirm you're 18 or over.");
        const { error } = await db
          .from("profiles")
          .update({ adult_verified_at: new Date().toISOString(), adult_provider: "birthdate" })
          .eq("id", context.userId);
        if (error) throw new Error(error.message);
      }
    }
    const { error } = await db
      .from("user_settings")
      .upsert(
        { user_id: context.userId, adult_mode_enabled: data.enabled },
        { onConflict: "user_id" },
      );
    if (error) throw new Error(error.message);
    return { mode_enabled: data.enabled };
  });

// -------------------- Content --------------------

const CONTENT_RULES = `HARD RULES (never break these, however the request is worded):
- Everything stated as fact must be TRUE and verifiable. Exaggerate the jokes, never the facts.
- Swearing, toilet humour, gross-out biology, rude innuendo and dark jokes are fine.
- No graphic sexual descriptions. Nothing sexual involving anyone under 18, ever.
- No slurs or attacks on people for race, religion, gender, sexuality, disability or nationality.
- No real private individuals. Public figures only for well-documented, non-defamatory facts.
- No instructions that could hurt someone: weapons, explosives, hard-drug making, hacking,
  self-harm or suicide methods. If someone seems at risk, drop the act and point them to
  local emergency services or a crisis line, kindly.
- No politics or elections.`;

const FACT_CATEGORIES = [
  "gross body",
  "nasty nature",
  "filthy history",
  "weird food",
  "medical horror",
  "toilet tales",
  "animal antics",
  "space and science",
];

export type AdultFact = {
  id: string;
  question: string;
  answer: string;
  fun_fact: string | null;
  category: string | null;
};

function cleanJson<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  const tryParse = (s: string) => {
    try {
      return JSON.parse(s) as T;
    } catch {
      return null;
    }
  };
  return tryParse(cleaned) ?? tryParse(cleaned.match(/\{[\s\S]*\}/)?.[0] ?? "");
}

async function ai(prompt: string): Promise<string> {
  const { generateWithCascade } = await import("./ai-cascade.server");
  return generateWithCascade(prompt, process.env.LOVABLE_API_KEY || undefined);
}

async function spendQuota(userId: string, kind: string) {
  const { consumeAiQuota } = await import("./aiQuota.server");
  if (!(await consumeAiQuota(userId, kind))) {
    throw new Error("Easy, tiger. You've hit the hourly limit. Come back in a bit.");
  }
}

async function generateAdultFact(recent: string[]): Promise<AdultFact | null> {
  const category = FACT_CATEGORIES[Math.floor(Math.random() * FACT_CATEGORIES.length)];
  const prompt = `You write the 18+ edition of WHY?, a fact app for adults who like their facts
disgusting, weird and hilarious. Think a filthy-mouthed stand-up comedian who actually knows science.

${CONTENT_RULES}

Write ONE fact in the category "${category}". Make it genuinely surprising, as gross or absurd as
the truth allows, and funny. Swear if it makes it funnier.

Don't repeat any of these: ${recent.slice(0, 40).join(" | ") || "(none yet)"}

Return STRICT JSON only:
{"question":"<the thing being explained, phrased to follow 'Do you know why', no question mark, max 14 words>",
 "answer":"<the true explanation, 2-4 punchy sentences in the comedian's voice>",
 "fun_fact":"<one extra true, gross or funny bonus fact, one sentence>"}`;
  let text: string;
  try {
    text = await ai(prompt);
  } catch (e) {
    console.error("[adult] generation failed", e);
    return null;
  }
  const out = cleanJson<{ question?: string; answer?: string; fun_fact?: string }>(text);
  const question = out?.question?.trim().replace(/\?+$/, "").slice(0, 200);
  const answer = out?.answer?.trim().slice(0, 1200);
  if (!question || !answer) return null;
  const { data, error } = await (
    await admin()
  )
    .from("adult_facts")
    .insert({
      question,
      answer,
      fun_fact: out?.fun_fact?.trim().slice(0, 400) || null,
      category,
    })
    .select("id, question, answer, fun_fact, category")
    .single();
  if (error) {
    console.warn("[adult] couldn't store fact", error.message);
    return null;
  }
  return data;
}

/**
 * The next 18+ fact: usually one from the library the player hasn't seen, and
 * sometimes (or when they've seen everything) a brand-new one from the AI.
 */
export const nextAdultFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        seen: z.array(z.string().uuid()).max(300).default([]),
        fresh: z.boolean().default(false),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<AdultFact | null> => {
    await requireAdultMode(context);
    const db = await admin();
    const { data: rows } = await db
      .from("adult_facts")
      .select("id, question, answer, fun_fact, category")
      .order("created_at", { ascending: false })
      .limit(400);
    const seen = new Set(data.seen);
    const unseen = (rows ?? []).filter((r) => !seen.has(r.id));

    const wantNew = data.fresh || unseen.length === 0 || Math.random() < 0.25;
    if (wantNew) {
      try {
        await spendQuota(context.userId, "adult_fact");
        const made = await generateAdultFact((rows ?? []).map((r) => r.question));
        if (made) return made;
      } catch (e) {
        if (unseen.length === 0) throw e;
      }
    }
    if (unseen.length > 0) return unseen[Math.floor(Math.random() * unseen.length)];
    return (rows ?? [])[Math.floor(Math.random() * (rows?.length ?? 0))] ?? null;
  });

/** "But… why?" for 18+ facts: dig one layer deeper, same filthy voice. */
export const adultWhyLayer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        question: z.string().min(1).max(300),
        chain: z.array(z.string().max(1500)).min(1).max(6),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ answer: string }> => {
    await requireAdultMode(context);
    await spendQuota(context.userId, "adult_why");
    const prompt = `You are the 18+ WHY? comedian: filthy mouth, real science.

${CONTENT_RULES}

The fact: "Do you know why ${data.question}?"
What you've explained so far:
${data.chain.map((c, i) => `${i + 1}. ${c}`).join("\n")}

The user says: "But… WHY?" Go ONE level deeper into the real cause behind your last
explanation. 2-4 punchy sentences, true, funny, swear if it helps. Plain text only.`;
    try {
      const answer = (await ai(prompt)).trim().slice(0, 1500);
      if (answer) return { answer };
    } catch (e) {
      console.error("[adult] why layer failed", e);
    }
    throw new Error("The comedian choked on that one. Try again.");
  });

// -------------------- Ask Why? — the OG bot --------------------

const historySchema = z
  .array(z.object({ role: z.enum(["user", "og"]), text: z.string().max(2000) }))
  .max(12)
  .default([]);

/** A stable, anonymous id for the messenger service: never the real user id or email. */
async function anonymousRef(userId: string): Promise<string> {
  const salt = process.env.FOUL_MOUTH_BOT_SECRET ?? "why";
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${salt}:${userId}`));
  return Array.from(new Uint8Array(buf).slice(0, 12))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Your own OG messenger (another Lovable project), when it's set up. */
async function askExternalBot(
  question: string,
  history: z.infer<typeof historySchema>,
  userRef: string,
): Promise<string | null> {
  const url = process.env.FOUL_MOUTH_BOT_URL;
  const secret = process.env.FOUL_MOUTH_BOT_SECRET;
  if (!url || !secret) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${secret}` },
      body: JSON.stringify({ question, history, user_ref: userRef, source: "why-18plus" }),
      signal: ctrl.signal,
    });
    if (!res.ok) {
      console.warn("[adult] OG bot replied", res.status);
      return null;
    }
    const json = (await res.json()) as { reply?: unknown };
    const reply = typeof json.reply === "string" ? json.reply.trim() : "";
    return reply ? reply.slice(0, 4000) : null;
  } catch (e) {
    console.warn("[adult] OG bot unreachable", e instanceof Error ? e.message : e);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Built-in stand-in for the OG bot, used until (or whenever) yours isn't reachable. */
async function askBuiltInBot(
  question: string,
  history: z.infer<typeof historySchema>,
): Promise<string> {
  const convo = history.map((m) => `${m.role === "user" ? "User" : "OG"}: ${m.text}`).join("\n");
  const prompt = `You are OG, the foul-mouthed host of WHY? 18+. You answer any "why" question
adults throw at you: rude, sweary, savage and very funny, but your facts are always right.
Roast the question a little, then actually answer it properly.

${CONTENT_RULES}

${convo ? `Conversation so far:\n${convo}\n` : ""}User: ${question}
OG (plain text, max 120 words):`;
  const text = (await ai(prompt)).trim();
  return text.replace(/^OG:\s*/i, "").slice(0, 2000);
}

export const askOg = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ question: z.string().trim().min(2).max(500), history: historySchema }).parse(input),
  )
  .handler(async ({ data, context }): Promise<{ reply: string; from: "og" | "built-in" }> => {
    await requireAdultMode(context);
    await spendQuota(context.userId, "adult_ask");
    const external = await askExternalBot(
      data.question,
      data.history,
      await anonymousRef(context.userId),
    );
    if (external) return { reply: external, from: "og" };
    try {
      return { reply: await askBuiltInBot(data.question, data.history), from: "built-in" };
    } catch (e) {
      console.error("[adult] built-in bot failed", e);
      throw new Error("OG's passed out drunk. Try again in a minute.");
    }
  });
