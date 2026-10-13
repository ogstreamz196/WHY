// Public player profile — read-only, safe columns only. Anyone (including
// signed-out users) can look up another player's public leaderboard card.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Outfit } from "./avatarItems";

export type PlayerProfilePublic = {
  user_id: string;
  username: string | null;
  display_name: string | null;
  avatar_id: string | null;
  avatar_outfit: Outfit;
  age_band: string | null;
  favorite_category: string | null;
  bio: string | null;
  joined_at: string | null;
  is_vip: boolean;
  // Curiosity Score aggregates
  total_score: number;
  facts_seen: number;
  current_streak: number;
  longest_streak: number;
  // Quiz aggregates
  quiz_best_score: number;
  quiz_questions_answered: number;
  quiz_correct_answered: number;
  quiz_best_streak: number;
  quiz_accuracy: number; // 0..100
};

export const getPlayerProfilePublic = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data }): Promise<PlayerProfilePublic | null> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const uid = data.userId;

    const { readOutfit } = await import("./avatarOutfit.server");
    const [profileRes, lbRes, quizRes, vipRes, outfit] = await Promise.all([
      supabaseAdmin
        .from("profiles_public")
        .select("id, username, display_name, avatar_id, favorite_category, bio, created_at")
        .eq("id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("leaderboard_global")
        .select("age_band, score, current_streak, longest_streak, facts_seen")
        .eq("user_id", uid)
        .maybeSingle(),
      supabaseAdmin
        .from("quiz_stats")
        .select("best_score, questions_answered, correct_answered, best_streak")
        .eq("user_id", uid)
        .maybeSingle(),
      (async () => {
        const { plusUserIds } = await import("./plus.server");
        return (await plusUserIds([uid])).has(uid);
      })(),
      readOutfit(uid),
    ]);

    const profile = profileRes.data;
    if (!profile) return null;

    const lb = lbRes.data ?? null;
    const quiz = quizRes.data ?? null;
    const answered = quiz?.questions_answered ?? 0;
    const correct = quiz?.correct_answered ?? 0;

    return {
      user_id: uid,
      username: profile.username ?? null,
      display_name: profile.display_name ?? null,
      avatar_id: profile.avatar_id ?? null,
      avatar_outfit: outfit,
      age_band: lb?.age_band ?? null,
      favorite_category: profile.favorite_category ?? null,
      bio: profile.bio ?? null,
      joined_at: profile.created_at ?? null,
      is_vip: !!vipRes,
      total_score: lb?.score ?? 0,
      facts_seen: lb?.facts_seen ?? 0,
      current_streak: lb?.current_streak ?? 0,
      longest_streak: lb?.longest_streak ?? 0,
      quiz_best_score: quiz?.best_score ?? 0,
      quiz_questions_answered: answered,
      quiz_correct_answered: correct,
      quiz_best_streak: quiz?.best_streak ?? 0,
      quiz_accuracy: answered > 0 ? Math.round((correct / answered) * 100) : 0,
    };
  });
