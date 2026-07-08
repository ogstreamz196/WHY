// Quiz server functions — startQuiz, submitAnswer, finishQuiz, leaderboards.
// Scoring is authoritative on the server; correct answers never leave the
// server until an answer is submitted for that fact.
import { createServerFn } from "@tanstack/react-start";
import { generateText } from "ai";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { awardXp } from "./account.functions";
import { awardAmountForUser } from "./vipStatus";

// ---------------- Types ----------------

export type Difficulty = "easy" | "medium" | "hard" | "expert";

export type QuizQuestionPublic = {
  fact_id: string;
  category: string | null;
  difficulty: Difficulty;
  question: string;
  choices: string[]; // 4 entries, order shuffled server-side
  fun_fact: string | null;
};

export type QuizStartResult = {
  session_id: string;
  category: string | null;
  difficulty: Difficulty;
  question_count: number;
  questions: QuizQuestionPublic[];
};

export type AnswerResult = {
  correct: boolean;
  correct_index: number;
  correct_answer: string;
  explanation: string | null;
  points_awarded: number;
  current_streak: number;
  best_streak: number;
};

export type FinishResult = {
  session_id: string;
  score: number;
  correct_count: number;
  question_count: number;
  accuracy: number;
  perfect: boolean;
  bonus_points: number;
  xp_delta: number;
  unlocked_achievements: string[];
};

export type LeaderboardEntry = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  xp?: number;
  quiz_score?: number;
  week_score?: number;
  best_score?: number;
  quizzes_played?: number;
  questions_answered?: number;
  correct_answered?: number;
  best_this_week?: number;
};

// ---------------- Constants ----------------

const LENGTH_DEFAULT = 5;
const LENGTH_MIN = 3;
const LENGTH_MAX = 10;
const SPEED_BONUS_MS = 5000;
const DIFF_MULTIPLIER: Record<Difficulty, number> = {
  easy: 1,
  medium: 1.25,
  hard: 1.5,
  expert: 2,
};

// ---------------- Helpers ----------------

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

type AiClient = ReturnType<typeof createLovableAiGatewayProvider>;

async function generateDistractors(
  ai: AiClient | null,
  fact: { question: string; answer: string; category: string | null },
): Promise<{ distractors: string[]; explanation: string }> {
  const fallback = () => ({
    distractors: [
      "None of the above",
      "It just happens naturally",
      "Scientists are still not sure",
    ],
    explanation: fact.answer,
  });
  if (!ai) return fallback();
  try {
    const prompt =
      `You are writing a fun trivia quiz for curious kids and adults.\n` +
      `Question: ${fact.question}\n` +
      `Correct answer: ${fact.answer}\n` +
      `Category: ${fact.category ?? "general"}\n\n` +
      `Return ONLY valid JSON of the form:\n` +
      `{"distractors":["A","B","C"],"explanation":"one-sentence explanation"}\n` +
      `Rules:\n` +
      `- 3 plausible but clearly WRONG short answers (max 8 words each).\n` +
      `- Same tone/length as the correct answer.\n` +
      `- Do NOT repeat or paraphrase the correct answer.\n` +
      `- Explanation: 1-2 friendly sentences, no more than 220 chars.`;
    const { text } = await generateText({
      model: ai("google/gemini-2.5-flash-lite"),
      prompt,
      maxRetries: 1,
    });
    const cleaned = text
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start === -1 || end === -1) return fallback();
    const parsed = JSON.parse(cleaned.slice(start, end + 1)) as {
      distractors?: unknown;
      explanation?: unknown;
    };
    const distractors = Array.isArray(parsed.distractors)
      ? parsed.distractors
          .map((d) => String(d).trim())
          .filter((d) => d && d.toLowerCase() !== fact.answer.toLowerCase())
          .slice(0, 3)
      : [];
    if (distractors.length < 3) return fallback();
    const explanation =
      typeof parsed.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim().slice(0, 300)
        : fact.answer;
    return { distractors, explanation };
  } catch (err) {
    console.warn("[quiz] distractor gen failed:", err);
    return fallback();
  }
}

/** Difficulty picker based on answer length + fact freshness heuristics. */
function inferDifficulty(answerLen: number): Difficulty {
  if (answerLen < 40) return "easy";
  if (answerLen < 90) return "medium";
  if (answerLen < 160) return "hard";
  return "expert";
}

// ---------------- startQuiz ----------------

export const startQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        category: z.string().min(1).max(40).optional(),
        difficulty: z.enum(["easy", "medium", "hard", "expert"]).optional(),
        length: z.number().int().min(LENGTH_MIN).max(LENGTH_MAX).optional(),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<QuizStartResult> => {
    const length = data.length ?? LENGTH_DEFAULT;
    const difficulty = data.difficulty ?? "medium";

    // Pull a random pool of facts (bigger than length so we can filter).
    let query = context.supabase
      .from("facts")
      .select("id, question, answer, category, fun_fact")
      .limit(length * 6);
    if (data.category && data.category !== "all") {
      query = query.eq("category", data.category);
    }
    const { data: pool, error } = await query;
    if (error) throw new Error(error.message);
    if (!pool || pool.length === 0) {
      throw new Error("No facts available for this category yet.");
    }
    const picked = shuffle(pool).slice(0, length);
    const factIds = picked.map((f) => f.id);

    // Look up existing cached questions
    const { data: cached } = await context.supabase
      .from("quiz_questions")
      .select("fact_id, correct_answer, distractors, explanation, difficulty, category")
      .in("fact_id", factIds);
    const cacheMap = new Map(
      (cached ?? []).map((c) => [c.fact_id as string, c] as const),
    );

    // Generate any missing (concurrently, capped).
    const missing = picked.filter((f) => !cacheMap.has(f.id));
    if (missing.length > 0) {
      const apiKey = process.env.LOVABLE_API_KEY;
      const ai = apiKey ? createLovableAiGatewayProvider(apiKey) : null;
      const results = await Promise.all(
        missing.map(async (f) => {
          const gen = await generateDistractors(ai, f);
          return { fact: f, ...gen };
        }),
      );
      const rowsToInsert = results.map(({ fact, distractors, explanation }) => ({
        fact_id: fact.id,
        category: fact.category,
        difficulty: inferDifficulty((fact.answer ?? "").length),
        correct_answer: fact.answer,
        distractors,
        explanation,
      }));
      if (rowsToInsert.length > 0) {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        await supabaseAdmin.from("quiz_questions").upsert(rowsToInsert, { onConflict: "fact_id" });
        for (const r of rowsToInsert) {
          cacheMap.set(r.fact_id, r as never);
        }
      }
    }

    // Build public questions (shuffle choices, remember order per-question).
    const answerOrder: number[] = []; // 0..3 index of correct answer per question, in question order
    const questions: QuizQuestionPublic[] = picked.map((f) => {
      const q = cacheMap.get(f.id)!;
      const correct = q.correct_answer as string;
      const distractors = (q.distractors as string[]).slice(0, 3);
      const choices = shuffle([correct, ...distractors]);
      answerOrder.push(choices.indexOf(correct));
      return {
        fact_id: f.id,
        category: f.category,
        difficulty: (q.difficulty as Difficulty) ?? difficulty,
        question: f.question,
        choices,
        fun_fact: f.fun_fact,
      };
    });

    const { data: session, error: sErr } = await context.supabase
      .from("quiz_sessions")
      .insert({
        user_id: context.userId,
        category: data.category === "all" ? null : data.category ?? null,
        difficulty,
        question_count: length,
        fact_ids: factIds,
        answer_order: answerOrder,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);

    return {
      session_id: session.id as string,
      category: data.category ?? null,
      difficulty,
      question_count: length,
      questions,
    };
  });

// ---------------- submitAnswer ----------------

export const submitAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        session_id: z.string().uuid(),
        fact_id: z.string().uuid(),
        picked_index: z.number().int().min(0).max(3),
        ms_taken: z.number().int().min(0).max(600_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AnswerResult> => {
    const { data: session, error: sErr } = await context.supabase
      .from("quiz_sessions")
      .select("id, user_id, difficulty, fact_ids, answer_order, correct_count, score, finished_at")
      .eq("id", data.session_id)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session || session.user_id !== context.userId) {
      throw new Error("Session not found.");
    }
    if (session.finished_at) throw new Error("Session already finished.");

    const factIds = (session.fact_ids ?? []) as string[];
    const answerOrder = (session.answer_order ?? []) as number[];
    const idx = factIds.indexOf(data.fact_id);
    if (idx === -1) throw new Error("Fact not part of this session.");
    const correctIdx = answerOrder[idx];
    const correct = data.picked_index === correctIdx;
    const difficulty = (session.difficulty as Difficulty) ?? "medium";

    // Compute points server-side
    const clampedMs = Math.max(500, Math.min(data.ms_taken, 60_000));
    let points = 0;
    if (correct) {
      points = 10;
      if (clampedMs < SPEED_BONUS_MS) points += 5;
      points = Math.round(points * DIFF_MULTIPLIER[difficulty]);
    }

    const { data: qrow } = await context.supabase
      .from("quiz_questions")
      .select("correct_answer, explanation")
      .eq("fact_id", data.fact_id)
      .maybeSingle();

    // Insert answer (unique on session+fact — dupes rejected).
    const { error: ansErr } = await context.supabase.from("quiz_answers").insert({
      session_id: session.id,
      user_id: context.userId,
      fact_id: data.fact_id,
      picked_index: data.picked_index,
      correct,
      ms_taken: clampedMs,
      points_awarded: points,
    });
    if (ansErr && !ansErr.message.includes("duplicate")) {
      throw new Error(ansErr.message);
    }

    // Update session running totals.
    await context.supabase
      .from("quiz_sessions")
      .update({
        correct_count: (session.correct_count ?? 0) + (correct ? 1 : 0),
        score: (session.score ?? 0) + points,
      })
      .eq("id", session.id);

    // Update streaks in quiz_stats
    const { data: prevStats } = await context.supabase
      .from("quiz_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const prevCurrent = prevStats?.current_streak ?? 0;
    const prevBest = prevStats?.best_streak ?? 0;
    const nextCurrent = correct ? prevCurrent + 1 : 0;
    const nextBest = Math.max(prevBest, nextCurrent);
    const nextFast =
      (prevStats?.fast_correct ?? 0) + (correct && clampedMs < 3000 ? 1 : 0);
    const cats = new Set<string>((prevStats?.categories_answered as string[]) ?? []);
    const catForFact = (
      await context.supabase
        .from("facts")
        .select("category")
        .eq("id", data.fact_id)
        .maybeSingle()
    ).data?.category;
    if (catForFact) cats.add(catForFact);

    await context.supabase.from("quiz_stats").upsert(
      {
        user_id: context.userId,
        total_score: (prevStats?.total_score ?? 0) + points,
        best_score: prevStats?.best_score ?? 0,
        questions_answered: (prevStats?.questions_answered ?? 0) + 1,
        correct_answered: (prevStats?.correct_answered ?? 0) + (correct ? 1 : 0),
        current_streak: nextCurrent,
        best_streak: nextBest,
        fast_correct: nextFast,
        categories_answered: Array.from(cats),
        favorite_category:
          prevStats?.favorite_category ??
          (catForFact ?? prevStats?.favorite_category ?? null),
      },
      { onConflict: "user_id" },
    );

    return {
      correct,
      correct_index: correctIdx,
      correct_answer: (qrow?.correct_answer as string) ?? "",
      explanation: (qrow?.explanation as string) ?? null,
      points_awarded: points,
      current_streak: nextCurrent,
      best_streak: nextBest,
    };
  });

// ---------------- finishQuiz ----------------

export const finishQuiz = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<FinishResult> => {
    const { data: session, error } = await context.supabase
      .from("quiz_sessions")
      .select("*")
      .eq("id", data.session_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!session || session.user_id !== context.userId) {
      throw new Error("Session not found.");
    }

    const questionCount = session.question_count ?? 0;
    const correctCount = session.correct_count ?? 0;
    const baseScore = session.score ?? 0;
    const perfect = questionCount > 0 && correctCount === questionCount;
    const bonus = perfect ? Math.round(baseScore * 0.5) : 0;
    const finalScore = baseScore + bonus;
    const accuracy =
      questionCount > 0 ? Math.round((correctCount / questionCount) * 10000) / 100 : 0;

    if (!session.finished_at) {
      await context.supabase
        .from("quiz_sessions")
        .update({
          finished_at: new Date().toISOString(),
          score: finalScore,
          accuracy,
        })
        .eq("id", session.id);
    }

    // XP: award quiz score as XP into user_stats.total_points too.
    const { data: prevStats } = await context.supabase
      .from("quiz_stats")
      .select("total_score, best_score")
      .eq("user_id", context.userId)
      .maybeSingle();
    const nextBest = Math.max(prevStats?.best_score ?? 0, finalScore);
    if (bonus > 0 || nextBest !== (prevStats?.best_score ?? 0)) {
      await context.supabase.from("quiz_stats").upsert(
        {
          user_id: context.userId,
          total_score: (prevStats?.total_score ?? 0) + bonus,
          best_score: nextBest,
        },
        { onConflict: "user_id" },
      );
    }

    const { data: userStats } = await context.supabase
      .from("user_stats")
      .select("total_points, current_streak, longest_streak, facts_seen, last_active_day")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (userStats) {
      await context.supabase
        .from("user_stats")
        .update({
          total_points: (userStats.total_points ?? 0) + finalScore,
        })
        .eq("user_id", context.userId);
    }

    if (finalScore > 0) {
      await awardXp(context, "quiz", finalScore, session.category ?? null);
    }

    // Achievement checks (quiz-specific)
    const unlocked = await checkQuizAchievements(context);

    return {
      session_id: session.id,
      score: finalScore,
      correct_count: correctCount,
      question_count: questionCount,
      accuracy,
      perfect,
      bonus_points: bonus,
      xp_delta: finalScore,
      unlocked_achievements: unlocked,
    };
  });

// ---------------- Achievement checks ----------------

type AuthContext = {
  supabase: import("@supabase/supabase-js").SupabaseClient;
  userId: string;
};

async function checkQuizAchievements(context: AuthContext): Promise<string[]> {
  const { data: stats } = await context.supabase
    .from("quiz_stats")
    .select("*")
    .eq("user_id", context.userId)
    .maybeSingle();
  if (!stats) return [];

  const { count: sessionsCount } = await context.supabase
    .from("quiz_sessions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", context.userId)
    .not("finished_at", "is", null);

  const { data: perfectRow } = await context.supabase
    .from("quiz_sessions")
    .select("id")
    .eq("user_id", context.userId)
    .not("finished_at", "is", null)
    .filter("correct_count", "eq", "question_count")
    .limit(1)
    .maybeSingle();

  const catsCount = ((stats.categories_answered as string[]) ?? []).length;

  const rules: Record<string, boolean> = {
    quiz_first: (sessionsCount ?? 0) >= 1,
    quiz_streak_7: (stats.best_streak ?? 0) >= 7,
    quiz_100: (stats.questions_answered ?? 0) >= 100,
    quiz_master_explorer: catsCount >= 8,
    quiz_speed_genius: (stats.fast_correct ?? 0) >= 10,
    quiz_perfect: !!perfectRow,
    quiz_1000: (stats.total_score ?? 0) >= 1000,
    quiz_5000: (stats.total_score ?? 0) >= 5000,
  };
  const candidates = Object.entries(rules)
    .filter(([, ok]) => ok)
    .map(([id]) => id);
  if (candidates.length === 0) return [];

  const { data: already } = await context.supabase
    .from("user_achievements")
    .select("achievement_id")
    .eq("user_id", context.userId)
    .in("achievement_id", candidates);
  const have = new Set((already ?? []).map((r) => r.achievement_id));
  const toInsert = candidates.filter((id) => !have.has(id));
  if (toInsert.length === 0) return [];
  await context.supabase
    .from("user_achievements")
    .insert(toInsert.map((id) => ({ user_id: context.userId, achievement_id: id })));
  return toInsert;
}

// ---------------- Stats & leaderboards ----------------

export type QuizStatsDTO = {
  total_score: number;
  best_score: number;
  questions_answered: number;
  correct_answered: number;
  accuracy: number;
  best_streak: number;
  current_streak: number;
  favorite_category: string | null;
  categories_answered: string[];
};

export const getMyQuizStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<QuizStatsDTO> => {
    const { data } = await context.supabase
      .from("quiz_stats")
      .select("*")
      .eq("user_id", context.userId)
      .maybeSingle();
    const questions = data?.questions_answered ?? 0;
    const correct = data?.correct_answered ?? 0;
    return {
      total_score: data?.total_score ?? 0,
      best_score: data?.best_score ?? 0,
      questions_answered: questions,
      correct_answered: correct,
      accuracy: questions > 0 ? Math.round((correct / questions) * 1000) / 10 : 0,
      best_streak: data?.best_streak ?? 0,
      current_streak: data?.current_streak ?? 0,
      favorite_category: (data?.favorite_category as string | null) ?? null,
      categories_answered: ((data?.categories_answered as string[]) ?? []),
    };
  });

export const getGlobalLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<LeaderboardEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("leaderboard_global")
      .select("*")
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeaderboardEntry[];
  });

export const getWeeklyLeaderboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ limit: z.number().int().min(1).max(100).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<LeaderboardEntry[]> => {
    const { data: rows, error } = await context.supabase
      .from("leaderboard_weekly")
      .select("*")
      .limit(data.limit ?? 50);
    if (error) throw new Error(error.message);
    return (rows ?? []) as LeaderboardEntry[];
  });
