import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { generateText } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";

function getSupabase() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export type Fact = {
  id: string;
  question: string;
  answer: string;
  category: string | null;
  fun_fact: string | null;
};

const FACT_COLS = "id, question, answer, category, fun_fact";

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
    if (data.excludeId) skip.add(data.excludeId);

    const base = () => {
      let q = supabase.from("facts").select(FACT_COLS);
      if (data.category) q = q.eq("category", data.category);
      return q;
    };

    let countQuery = supabase.from("facts").select("id", { count: "exact", head: true });
    if (data.category) countQuery = countQuery.eq("category", data.category);
    const { count } = await countQuery;
    if (!count || count === 0) {
      const { data: any } = await supabase.from("facts").select(FACT_COLS).limit(1);
      return (any?.[0] as Fact) ?? null;
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

    // Truly exhausted — return any row so the UI doesn't stall.
    const { data: fallback } = await base().limit(1);
    return (fallback?.[0] as Fact) ?? null;
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

async function callJson<T>(apiKey: string, prompt: string, model = "google/gemini-2.5-flash"): Promise<T | null> {
  const gateway = createLovableAiGatewayProvider(apiKey);
  const { text } = await generateText({ model: gateway(model), prompt });
  const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
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
  .inputValidator((input: unknown) =>
    z.object({ category: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Fact | null> => {
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
${recentQs.slice(0, 30).map((q) => `- ${q}`).join("\n") || "(none)"}`;

    // Try up to 3 candidates, each with quality gate.
    for (let attempt = 0; attempt < 3; attempt++) {
      const candidate = await callJson<GeneratedFact>(apiKey, genPrompt);
      if (!candidate?.question || !candidate.answer || !candidate.fun_fact) continue;

      const check = await qualityCheck(apiKey, candidate, recentQs);
      if (!check.ok) {
        console.log("[why?] rejected candidate:", check.reason, candidate.question);
        continue;
      }

      const { data: inserted, error } = await admin
        .from("facts")
        .insert({
          question: candidate.question.trim(),
          answer: candidate.answer.trim(),
          fun_fact: candidate.fun_fact.trim(),
          category,
        })
        .select(FACT_COLS)
        .single();

      if (!error && inserted) return inserted as Fact;
      // duplicate unique index → try again
    }

    // Everything failed → return a random existing fact so UX doesn't stall.
    const supabase = getSupabase();
    const { data: fallback } = await supabase
      .from("facts")
      .select(FACT_COLS)
      .order("created_at", { ascending: false })
      .limit(1);
    return (fallback?.[0] as Fact) ?? null;
  });

// -------------------- Search or generate --------------------

export const searchOrGenerateFact = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<Fact | null> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    const supabase = getSupabase();
    const q = data.query.trim().replace(/^why\s+/i, "").replace(/\?+$/, "");

    // 1. Try text match in DB first (question ilike)
    const { data: matches } = await supabase
      .from("facts")
      .select(FACT_COLS)
      .ilike("question", `%${q}%`)
      .limit(1);
    if (matches && matches[0]) return matches[0] as Fact;

    // 2. Ask AI to reformulate then generate + validate + store
    if (!apiKey) return null;
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

    const { data: inserted } = await admin
      .from("facts")
      .insert({
        question: candidate.question.trim(),
        answer: candidate.answer.trim(),
        fun_fact: candidate.fun_fact.trim(),
        category,
      })
      .select(FACT_COLS)
      .single();
    return (inserted as Fact) ?? null;
  });

// -------------------- "But… Why?" endless chain --------------------

export const generateWhyLayer = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        rootQuestion: z.string().min(1).max(300),
        previousChain: z.array(z.string()).max(10).default([]),
      })
      .parse(input),
  )
  .handler(async ({ data }): Promise<{ question: string; answer: string } | null> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) return null;

    const prompt = `${SAFETY_PROMPT}

The user is on a curiosity journey. Root question: "${data.rootQuestion}"

So far they've dug through these follow-ups (each one asked "but why?" about the previous answer):
${data.previousChain.length ? data.previousChain.map((s, i) => `${i + 1}. ${s}`).join("\n") : "(none yet — this is the first 'but why?')"}

Now write the NEXT layer: a natural "but why…" follow-up question AND a short kid-friendly answer that goes one level deeper.

Return STRICT JSON only, no prose, no markdown:
{"question":"<a short 'but why…' style follow-up question, ending with ?>","answer":"<2-3 short sentences an 8-12 year old can understand>"}`;

    const res = await callJson<{ question: string; answer: string }>(apiKey, prompt);
    if (!res?.question || !res?.answer) return null;
    return { question: res.question.trim(), answer: res.answer.trim() };
  });

// -------------------- Daily featured fact --------------------

export const getDailyFact = createServerFn({ method: "GET" }).handler(
  async (): Promise<Fact | null> => {
    const supabase = getSupabase();
    const { count } = await supabase
      .from("facts")
      .select("id", { count: "exact", head: true });
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
    const { count } = await supabase
      .from("facts")
      .select("id", { count: "exact", head: true });
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
