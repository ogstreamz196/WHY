import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { consumeAiQuota, consumeGuestAiQuota, optionalUserId } from "@/lib/aiQuota.server";

function getSupabase() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Facts a signed-in user has already seen on any device. */
async function serverSeenIds(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("discoveries")
      .select("fact_id")
      .eq("user_id", userId)
      .limit(5000);
    return (data ?? []).map((r) => r.fact_id as string);
  } catch {
    return [];
  }
}

export type Fact = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  fun_fact: string | null;
  code: string;
};

const FACT_COLS = "id, question, answer, category, fun_fact, code";

export const CATEGORY_KEYS = [
  "animals",
  "space",
  "earth",
  "science",
  "body",
  "weather",
  "food",
  "history",
  "technology",
  "ocean",
  "dinosaurs",
] as const;
export type CategoryKey = (typeof CATEGORY_KEYS)[number];

// -------------------- Random fact --------------------

// Curated fallback facts — served when the DB pool is empty or RLS filters out
// everything (fresh install, offline preview, anon visitors). Guarantees that
// every visitor — signed in or not — always sees a fact on the landing page.
const FALLBACK_FACTS: Fact[] = [
  {
    id: "00000000-0000-0000-0000-000000000001",
    question: "why is the sky blue",
    answer: "Sunlight scatters off tiny air molecules, and blue light scatters the most.",
    category: "science",
    fun_fact:
      "At sunset the light travels through more air, so only the reds and oranges reach your eyes.",
    code: "WHY-SKY001",
  },
  {
    id: "00000000-0000-0000-0000-000000000002",
    question: "why do we yawn",
    answer: "Your brain uses yawns to cool down and pull in a fresh burst of oxygen.",
    category: "body",
    fun_fact: "Yawns are contagious — just reading this might make you yawn!",
    code: "WHY-YWN002",
  },
  {
    id: "00000000-0000-0000-0000-000000000003",
    question: "why does the moon change shape",
    answer: "The Sun lights up different sides of the Moon as it orbits Earth.",
    category: "space",
    fun_fact: "One full cycle of Moon phases takes about 29.5 days.",
    code: "WHY-MOON03",
  },
];

function pickFallback(skip: Set<string>, category?: string): Fact {
  const pool = category ? FALLBACK_FACTS.filter((f) => f.category === category) : FALLBACK_FACTS;
  const list = pool.length ? pool : FALLBACK_FACTS;
  const fresh = list.filter((f) => !skip.has(f.id));
  const choice = (fresh.length ? fresh : list)[
    Math.floor(Math.random() * (fresh.length ? fresh.length : list.length))
  ];
  return choice;
}

export const getRandomFact = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z
      .object({
        excludeId: z.string().optional(),
        category: z.string().optional(),
        seenIds: z.array(z.string().uuid()).max(5000).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Fact | null> => {
    const supabase = getSupabase();
    // Build a set of ids to skip: caller's seen list + the current fact.
    const skip = new Set<string>(data.seenIds ?? []);
    const uid = await optionalUserId().catch(() => null);
    for (const id of await serverSeenIds(uid)) skip.add(id);
    if (data.excludeId) skip.add(data.excludeId);

    const base = () => {
      let q = supabase.from("facts").select(FACT_COLS);
      if (data.category) q = q.eq("category", data.category);
      return q;
    };

    try {
      let countQuery = supabase.from("facts").select("id", { count: "exact", head: true });
      if (data.category) countQuery = countQuery.eq("category", data.category);
      const { count } = await countQuery;
      if (!count || count === 0) {
        // Signed-in players get a freshly written fact for this category instead.
        if (uid) return null;
        const { data: any } = await supabase.from("facts").select(FACT_COLS).limit(1);
        return (any?.[0] as Fact) ?? pickFallback(skip, data.category);
      }

      // If the caller has seen (nearly) everything in this scope, fall back to
      // any fact — we've exhausted the pool.
      const exhausted = skip.size >= count;

      for (let attempt = 0; attempt < 8 && !exhausted; attempt++) {
        const offset = Math.floor(Math.random() * count);
        const { data: rows } = await base()
          .order("created_at", { ascending: true })
          .range(offset, offset);
        const row = rows?.[0] as Fact | undefined;
        if (row && !skip.has(row.id)) return row;
      }

      // Deterministic scan for the first unseen row (handles clustered seens).
      if (!exhausted) {
        const { data: rows } = await base().order("created_at", { ascending: true }).limit(200);
        const fresh = (rows ?? []).find((r) => !skip.has((r as Fact).id));
        if (fresh) return fresh as Fact;
      }

      // Truly exhausted. Signed-in players get a freshly written fact (null
      // tells the client to generate one). Guests get a random old one, never
      // the fact already on screen, so "New fact" doesn't repeat itself.
      if (uid) return null;
      for (let attempt = 0; attempt < 4; attempt++) {
        const offset = Math.floor(Math.random() * count);
        const { data: rows } = await base()
          .order("created_at", { ascending: true })
          .range(offset, offset);
        const row = rows?.[0] as Fact | undefined;
        if (row && (row.id !== data.excludeId || count === 1)) return row;
      }
      return pickFallback(skip, data.category);
    } catch (err) {
      console.warn("getRandomFact failed, serving fallback", err);
      return pickFallback(skip, data.category);
    }
  });

// -------------------- AI helpers --------------------

const SAFETY_PROMPT = `You are writing content for the WHY? app used by kids, families, adults, and classrooms.

CONTENT RULES (non-negotiable):
- Must be scientifically accurate and widely accepted.
- Child-friendly, kind, positive tone.
- Easy English an 8–12 year old can read.
- No politics, no religion, no violence, no scary content.
- No misinformation, no myths presented as fact.
- No brand promotion, no personal opinions.
- Concise. No filler.`;

async function callJson<T>(apiKey: string, prompt: string): Promise<T | null> {
  const { generateWithCascade } = await import("@/lib/ai-cascade.server");
  let text: string;
  try {
    text = await generateWithCascade(prompt, apiKey || undefined);
  } catch (err) {
    console.error("[why?] all AI providers failed", err);
    return null;
  }
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]) as T;
    } catch {
      return null;
    }
  }
}

// -------------------- Generate + store --------------------

type GeneratedFact = { question: string; answer: string; fun_fact: string };

async function qualityCheck(
  apiKey: string,
  candidate: GeneratedFact,
  recentQuestions: string[],
): Promise<{ ok: boolean; reason?: string }> {
  const prompt = `${SAFETY_PROMPT}

You are a strict editor. Judge the fact below against ALL these checks:
1. scientifically_accurate
2. child_friendly
3. no_politics
4. no_religion
5. no_frightening_content
6. no_misinformation
7. easy_english
8. concise (question <= 15 words, answer <= 60 words, fun_fact <= 30 words)
9. not_duplicate — is this essentially the same idea as any of the recent questions?
10. interesting_enough — would a kid say "whoa" or "cool"?

Recent questions in database (avoid duplicates or trivial rewordings):
${recentQuestions.map((q) => `- ${q}`).join("\n") || "(none)"}

Candidate fact:
question: ${candidate.question}
answer: ${candidate.answer}
fun_fact: ${candidate.fun_fact}

Return STRICT JSON only, no prose, no markdown:
{"ok": true|false, "reason": "<short reason if not ok, else empty>"}`;

  const res = await callJson<{ ok: boolean; reason?: string }>(apiKey, prompt);
  return res ?? { ok: false, reason: "no_response" };
}

export const generateAndStoreFact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().optional(),
        seenIds: z.array(z.string().uuid()).max(5000).optional(),
        force: z.boolean().optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<Fact | null> => {
    const supabase = getSupabase();
    const skip = new Set<string>(data.seenIds ?? []);
    for (const id of await serverSeenIds(context.userId)) skip.add(id);

    // CYCLE FIRST: only generate a new fact when the caller has genuinely
    // exhausted the existing pool for this scope. This keeps the sheets DB
    // from growing until every entry has been served at least once.
    if (!data.force) {
      const unseen = await findUnseenFact(supabase, skip, data.category);
      if (unseen) return unseen;
    }

    if (!(await consumeAiQuota(context.userId, "fact"))) {
      return pickExistingFact(supabase, skip);
    }

    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");
    const admin = await getAdmin();

    const { data: recent } = await admin
      .from("facts")
      .select("question")
      .order("created_at", { ascending: false })
      .limit(50);
    const recentQs = (recent ?? []).map((r) => r.question as string);

    const category =
      data.category && (CATEGORY_KEYS as readonly string[]).includes(data.category)
        ? data.category
        : CATEGORY_KEYS[Math.floor(Math.random() * CATEGORY_KEYS.length)];

    const genPrompt = `${SAFETY_PROMPT}

Write ONE "Do you know why…" fact in category: ${category}

Return STRICT JSON only, no prose, no markdown:
{"question":"<lowercase phrase ending in '?' that reads after 'Do you know why '>","answer":"<2-3 short sentences an 8-12 year old can understand>","fun_fact":"<one short bonus fact (1 sentence, <=25 words) related to the answer>"}

Question examples: "the sky is blue?", "flamingos stand on one leg?", "we get goosebumps?"

Do NOT repeat or reword any of these recent questions:
${
  recentQs
    .slice(0, 30)
    .map((q) => `- ${q}`)
    .join("\n") || "(none)"
}`;

    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = await callJson<GeneratedFact>(apiKey, genPrompt);
      if (!candidate?.question || !candidate.answer || !candidate.fun_fact) continue;

      const check = await qualityCheck(apiKey, candidate, recentQs);
      if (!check.ok) {
        console.log("[why?] rejected candidate:", check.reason, candidate.question);
        continue;
      }

      const { normalizeStoredQuestion } = await import("@/lib/normalizeQuestion");
      const norm = normalizeStoredQuestion(candidate.question);
      if (!norm.ok) {
        console.log("[why?] grammar rejected:", norm.reason, candidate.question);
        continue;
      }

      const { data: inserted, error } = await admin
        .from("facts")
        .insert({
          question: norm.question,
          answer: candidate.answer.trim(),
          fun_fact: candidate.fun_fact.trim(),
          category,
        })
        .select("id, question, answer, category, fun_fact, code, code_seq, created_at")
        .single();

      if (!error && inserted) {
        // Fire-and-forget append to the Google Sheets library.
        const { appendFactToSheet } = await import("@/lib/sheets.server");
        void appendFactToSheet({
          code: inserted.code as string,
          code_seq: Number(inserted.code_seq ?? 0),
          category: inserted.category as string | null,
          question: inserted.question as string,
          answer: inserted.answer as string,
          fun_fact: (inserted.fun_fact as string | null) ?? null,
          created_at: inserted.created_at as string | null,
        });
        return inserted as Fact;
      }
    }

    // Fallback: return an unseen (or any) existing fact so UX doesn't stall.
    return pickExistingFact(supabase, skip);
  });

type PublicClient = ReturnType<typeof getSupabase>;

/** Oldest fact in scope the caller hasn't seen, scanning ids page by page. */
async function findUnseenFact(
  supabase: PublicClient,
  skip: Set<string>,
  category?: string,
): Promise<Fact | null> {
  const PAGE = 1000;
  for (let page = 0; page < 20; page++) {
    let q = supabase.from("facts").select("id");
    if (category) q = q.eq("category", category);
    const { data: ids } = await q
      .order("created_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1);
    if (!ids || ids.length === 0) return null;
    const hit = ids.find((r) => !skip.has(r.id as string));
    if (hit) {
      const { data: row } = await supabase
        .from("facts")
        .select(FACT_COLS)
        .eq("id", hit.id)
        .maybeSingle();
      return (row as Fact | null) ?? null;
    }
    if (ids.length < PAGE) return null;
  }
  return null;
}

async function pickExistingFact(supabase: PublicClient, skip: Set<string>): Promise<Fact | null> {
  const { data: fallback } = await supabase
    .from("facts")
    .select(FACT_COLS)
    .order("created_at", { ascending: false })
    .limit(50);
  const pick = (fallback ?? []).find((r) => !skip.has((r as Fact).id)) ?? fallback?.[0];
  return (pick as Fact) ?? null;
}

// -------------------- Search or generate --------------------

// Works for guests too (they get the smaller guest AI allowance), so search
// never just fails for someone who hasn't signed in.
export const searchOrGenerateFact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ query: z.string().min(2).max(200) }).parse(input))
  .handler(async ({ data }): Promise<Fact | null> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const supabase = getSupabase();
    const q = data.query
      .trim()
      .replace(/^why\s+/i, "")
      .replace(/\?+$/, "");

    // 1. The best existing fact, matched on the meaningful words.
    const { searchTerms, rankFacts } = await import("@/lib/searchRank");
    const terms = searchTerms(q);
    if (terms.length > 0) {
      const { data: matches } = await supabase
        .from("facts")
        .select(FACT_COLS)
        .or(terms.flatMap((t) => [`question.ilike.%${t}%`, `answer.ilike.%${t}%`]).join(","))
        .limit(80);
      const best = rankFacts((matches ?? []) as Fact[], q, 1)[0];
      // Only take it if it really answers this question (most words in its question).
      if (
        best &&
        terms.filter((t) => best.question.toLowerCase().includes(t)).length >=
          Math.ceil(terms.length * 0.6)
      ) {
        return best;
      }
    }

    // 2. Ask AI to reformulate then generate + validate + store
    if (!apiKey) return null;
    const userId = await optionalUserId().catch(() => null);
    const allowed = userId ? await consumeAiQuota(userId, "search") : await consumeGuestAiQuota();
    if (!allowed) return null;
    const admin = await getAdmin();
    const { data: recent } = await admin
      .from("facts")
      .select("question")
      .order("created_at", { ascending: false })
      .limit(40);
    const recentQs = (recent ?? []).map((r) => r.question as string);

    const genPrompt = `${SAFETY_PROMPT}

A user typed this "why" question: "${data.query}"

Produce a fact for the WHY? app that answers it. Return STRICT JSON only:
{"question":"<lowercase phrase after 'Do you know why ', ending with ?>","answer":"<2-3 short sentences>","fun_fact":"<1 short bonus fact>","category":"<one of: ${CATEGORY_KEYS.join(", ")}>"}

If the question is inappropriate, unsafe, or nonsensical for kids, instead return: {"reject": true}`;

    const candidate = await callJson<GeneratedFact & { category?: string; reject?: boolean }>(
      apiKey,
      genPrompt,
    );
    if (!candidate || candidate.reject) return null;
    if (!candidate.question || !candidate.answer || !candidate.fun_fact) return null;

    const check = await qualityCheck(apiKey, candidate, recentQs);
    if (!check.ok) return null;

    const category =
      candidate.category && (CATEGORY_KEYS as readonly string[]).includes(candidate.category)
        ? candidate.category
        : "science";

    const { normalizeStoredQuestion } = await import("@/lib/normalizeQuestion");
    const norm = normalizeStoredQuestion(candidate.question);
    if (!norm.ok) return null;

    const { data: inserted } = await admin
      .from("facts")
      .insert({
        question: norm.question,
        answer: candidate.answer.trim(),
        fun_fact: candidate.fun_fact.trim(),
        category,
      })
      .select("id, question, answer, category, fun_fact, code, code_seq, created_at")
      .single();
    if (inserted) {
      const { appendFactToSheet } = await import("@/lib/sheets.server");
      void appendFactToSheet({
        code: inserted.code as string,
        code_seq: Number(inserted.code_seq ?? 0),
        category: inserted.category as string | null,
        question: inserted.question as string,
        answer: inserted.answer as string,
        fun_fact: (inserted.fun_fact as string | null) ?? null,
        created_at: inserted.created_at as string | null,
      });
    }
    return (inserted as Fact) ?? null;
  });

// -------------------- Boss: decode a fact code --------------------

export const decodeFactCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().min(4).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    // Re-check the caller is an admin/boss before executing the definer RPC via service role.
    const { data: bossOk } = await context.supabase.rpc("is_boss", { _uid: context.userId });
    if (!bossOk) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("facts")
      .select("id, code, code_seq, category, question, answer, fun_fact, source, created_at")
      .eq("code", data.code)
      .maybeSingle();
    if (error) throw error;
    return (
      (row as {
        id: string;
        code: string;
        code_seq: number;
        category: string | null;
        question: string;
        answer: string;
        fun_fact: string | null;
        source: string;
        created_at: string;
      } | null) ?? null
    );
  });

// -------------------- "But… Why?" endless chain --------------------

export type WhyLayerResult =
  | { ok: true; question: string; answer: string; reward_id: string | null }
  | { ok: false; reason: "rate_limited" | "unavailable" };

// Open to guests too: the home page shows "But… Why?" before anyone signs in.
// Signed-in users are rate-limited per account, guests per IP.
export const generateWhyLayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        rootQuestion: z.string().min(1).max(300),
        previousChain: z.array(z.string().max(1000)).max(12).default([]),
        customQuestion: z.string().trim().min(3).max(200).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<WhyLayerResult> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return { ok: false, reason: "unavailable" };

    const userId = await optionalUserId().catch(() => null);
    const allowed = userId
      ? await consumeAiQuota(userId, "why_layer")
      : await consumeGuestAiQuota();
    if (!allowed) return { ok: false, reason: "rate_limited" };

    const prompt = `${SAFETY_PROMPT}

The user is on a curiosity journey. Root question: "${data.rootQuestion}"

So far they've dug through these follow-ups (each one asked "but why?" about the previous answer):
${data.previousChain.length ? data.previousChain.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(none yet — this is the first 'but why?')"}

${
  data.customQuestion
    ? `The user picked their own follow-up question: "${data.customQuestion}"
Use THEIR question as the next layer's question (lightly reworded to be a clear, kid-friendly question ending with ? if needed) and answer it.`
    : `Now write the NEXT layer: a natural "but why…" follow-up question AND a short kid-friendly answer that goes one level deeper.`
}

Return STRICT JSON only, no prose, no markdown:
{"question":"<a short 'but why…' style follow-up question, ending with ?>","answer":"<2-3 short sentences an 8-12 year old can understand>"}`;

    let res: { question: string; answer: string } | null = null;
    try {
      res = await callJson<{ question: string; answer: string }>(apiKey, prompt);
    } catch (e) {
      console.warn("[why?] but-why generation failed:", e);
      return { ok: false, reason: "unavailable" };
    }
    if (!res?.question || !res?.answer) return { ok: false, reason: "unavailable" };

    // Signed-in readers get a one-time reward ticket, claimed after the 3s read
    // via claimChainLayerReward. Guests earn local-only coins.
    let reward_id: string | null = null;
    if (userId) {
      const admin = await getAdmin();
      const { data: row, error } = await admin
        .from("chain_layer_rewards")
        .insert({ user_id: userId })
        .select("id")
        .single();
      if (error) console.warn("[why?] couldn't issue chain reward:", error.message);
      else reward_id = row.id;
    }
    return { ok: true, question: res.question.trim(), answer: res.answer.trim(), reward_id };
  });

// -------------------- Daily featured fact --------------------

export const getDailyFact = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fact | null> => {
    const supabase = getSupabase();
    const { count } = await supabase.from("facts").select("id", { count: "exact", head: true });
    if (!count) return null;
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const day = Math.floor((now.getTime() - start) / 86_400_000);
    const offset = day % count;
    const { data } = await supabase
      .from("facts")
      .select(FACT_COLS)
      .order("created_at", { ascending: true })
      .range(offset, offset);
    return (data?.[0] as Fact) ?? null;
  },
);

// -------------------- Daily multiple-choice challenge --------------------

export type DailyMCQ = {
  fact: Fact;
  prompt: string;
  choices: string[];
  correctIndex: number;
};

const mcqCache = new Map<string, DailyMCQ>();

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const getDailyChallengeMCQ = createServerFn({ method: "GET" }).handler(
  async (): Promise<DailyMCQ | null> => {
    const supabase = getSupabase();
    const { count } = await supabase.from("facts").select("id", { count: "exact", head: true });
    if (!count) return null;
    const now = new Date();
    const start = Date.UTC(now.getUTCFullYear(), 0, 0);
    const day = Math.floor((now.getTime() - start) / 86_400_000);
    const offset = day % count;
    const { data } = await supabase
      .from("facts")
      .select(FACT_COLS)
      .order("created_at", { ascending: true })
      .range(offset, offset);
    const fact = (data?.[0] as Fact) ?? null;
    if (!fact) return null;

    const cacheKey = `${day}:${fact.id}`;
    const cached = mcqCache.get(cacheKey);
    if (cached) return cached;

    const apiKey = process.env.LOVABLE_API_KEY;
    let correct = "";
    let distractors: string[] = [];

    if (apiKey) {
      const prompt = `${SAFETY_PROMPT}

You are creating a multiple-choice question for kids based on this fact:
Question: "Do you know why ${fact.question}"
Real answer: ${fact.answer}

Write:
- ONE short correct answer (max 12 words, single plain sentence, no leading "Because").
- THREE short WRONG-but-plausible distractor answers in the SAME format and length (max 12 words each). Clearly incorrect to an expert, tempting to a kid. No jokes, no "all of the above".

Return STRICT JSON only:
{"correct":"<short correct answer>","distractors":["<wrong 1>","<wrong 2>","<wrong 3>"]}`;
      const res = await callJson<{ correct: string; distractors: string[] }>(apiKey, prompt);
      if (res?.correct && Array.isArray(res.distractors) && res.distractors.length >= 3) {
        correct = res.correct.trim();
        distractors = res.distractors.slice(0, 3).map((d) => String(d).trim());
      }
    }

    if (!correct) {
      correct = (fact.answer.split(/(?<=[.!?])\s+/)[0] || fact.answer).slice(0, 140);
      distractors = [
        "It happens completely at random.",
        "Nobody knows the real reason yet.",
        "It's just a fun coincidence of nature.",
      ];
    }

    const all = shuffleArr([correct, ...distractors]);
    const mcq: DailyMCQ = {
      fact,
      prompt: `Do you know why ${fact.question}`,
      choices: all,
      correctIndex: all.indexOf(correct),
    };
    mcqCache.set(cacheKey, mcq);
    return mcq;
  },
);
