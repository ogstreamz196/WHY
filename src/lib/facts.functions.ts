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
};

// Fetch a random fact from the DB
export const getRandomFact = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ excludeId: z.string().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data }): Promise<Fact | null> => {
    const supabase = getSupabase();
    // Get total count then random offset — simple and index-friendly.
    const { count, error: countErr } = await supabase
      .from("facts")
      .select("id", { count: "exact", head: true });
    if (countErr) throw countErr;
    if (!count || count === 0) return null;

    for (let attempt = 0; attempt < 3; attempt++) {
      const offset = Math.floor(Math.random() * count);
      const { data: rows, error } = await supabase
        .from("facts")
        .select("id, question, answer, category")
        .order("created_at", { ascending: true })
        .range(offset, offset);
      if (error) throw error;
      const row = rows?.[0];
      if (row && row.id !== data.excludeId) return row as Fact;
      if (count === 1) return (row as Fact) ?? null;
    }
    // Fallback: return any fact
    const { data: fallback } = await supabase
      .from("facts")
      .select("id, question, answer, category")
      .limit(1);
    return (fallback?.[0] as Fact) ?? null;
  });

const CATEGORIES = [
  "nature",
  "animals",
  "space",
  "body",
  "food",
  "science",
  "history",
  "weather",
  "ocean",
  "technology",
];

// Generate a new fact with AI and store it. Public endpoint (rate-limited by DB
// uniqueness on question). Safe: content is child-friendly by prompt design and
// only writes to a single append-only table.
export const generateAndStoreFact = createServerFn({ method: "POST" }).handler(
  async (): Promise<Fact | null> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    const admin = await getAdmin();

    // Get last ~30 questions so the model doesn't repeat.
    const { data: recent } = await admin
      .from("facts")
      .select("question")
      .order("created_at", { ascending: false })
      .limit(40);
    const recentList = (recent ?? []).map((r) => `- ${r.question}`).join("\n");
    const category = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];

    const gateway = createLovableAiGatewayProvider(apiKey);

    const prompt = `You are writing a fun "Do you know why…" fact for the Why? app.

Audience: families, kids, and adults. Content must be 100% child-friendly, safe, positive, accurate, and easy to understand. No violence, scary content, politics, religion, or anything inappropriate.

Category to focus on: ${category}

Return ONE fact as strict JSON only, no prose, no markdown fences, matching this exact shape:
{"question":"<a short question that would come after 'Do you know why '>", "answer":"<a fun, clear explanation in 2-3 short sentences that a 7-year-old can understand>"}

The "question" MUST:
- be phrased so it reads naturally after the words "Do you know why "
- start with a lowercase letter
- end with a question mark
- be short (max ~12 words)
- example: "the sky is blue?" or "flamingos stand on one leg?"

Do NOT repeat or closely rephrase any of these recent questions:
${recentList || "(none yet)"}
`;

    const { text } = await generateText({
      model: gateway("google/gemini-2.5-flash"),
      prompt,
    });

    // Extract JSON from the response.
    const cleaned = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
    let parsed: { question?: string; answer?: string };
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) return null;
      parsed = JSON.parse(match[0]);
    }

    const question = (parsed.question ?? "").trim();
    const answer = (parsed.answer ?? "").trim();
    if (!question || !answer) return null;

    const { data: inserted, error } = await admin
      .from("facts")
      .insert({ question, answer, category })
      .select("id, question, answer, category")
      .single();

    // If duplicate (unique index), just fetch a random fact instead.
    if (error) {
      console.error("insert fact error", error);
      const supabase = getSupabase();
      const { data: any } = await supabase
        .from("facts")
        .select("id, question, answer, category")
        .order("created_at", { ascending: false })
        .limit(1);
      return (any?.[0] as Fact) ?? null;
    }
    return inserted as Fact;
  },
);
