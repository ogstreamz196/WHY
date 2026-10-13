// Public, read-only fact lookups: the shareable /fact pages and search.
// Everything goes through the public (anon) key, so database rules only ever
// return kid-safe facts; adult facts live elsewhere and can't appear here.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { rankFacts, searchTerms } from "./searchRank";

export type PublicFact = {
  id: string;
  code: string;
  question: string;
  answer: string;
  fun_fact: string | null;
  category: string | null;
  created_at: string | null;
};

const COLS = "id, code, question, answer, fun_fact, category, created_at";

function publicDb() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type FactPage = { fact: PublicFact; related: PublicFact[] };

/** One fact by its code (e.g. WHY-1A2B3C) and a few more from the same topic. */
export const getFactPage = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().regex(/^WHY-[0-9A-F]{6}$/) }).parse(input),
  )
  .handler(async ({ data }): Promise<FactPage | null> => {
    const db = publicDb();
    const { data: fact } = await db
      .from("facts")
      .select(COLS)
      .eq("code", data.code)
      .maybeSingle<PublicFact>();
    if (!fact) return null;
    let q = db.from("facts").select(COLS).neq("id", fact.id).not("code", "is", null);
    if (fact.category) q = q.eq("category", fact.category);
    const { data: related } = await q.order("created_at", { ascending: false }).limit(6);
    return { fact, related: (related ?? []) as PublicFact[] };
  });

/**
 * Search the fact library: matches on the meaningful words in the question,
 * best matches first. Works for guests too.
 */
export const searchFacts = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) =>
    z.object({ query: z.string().trim().min(2).max(200) }).parse(input),
  )
  .handler(async ({ data }): Promise<PublicFact[]> => {
    const terms = searchTerms(data.query);
    if (terms.length === 0) return [];
    // Terms are letters and digits only (see searchTerms), so they're safe
    // inside the filter string.
    const filter = terms.flatMap((t) => [`question.ilike.%${t}%`, `answer.ilike.%${t}%`]).join(",");
    const { data: rows, error } = await publicDb()
      .from("facts")
      .select(COLS)
      .or(filter)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.warn("[search]", error.message);
      return [];
    }
    return rankFacts((rows ?? []) as PublicFact[], data.query, 8);
  });
