// Per-user rate limit for AI generation (each call costs model credits).

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

/**
 * Records one AI action for the user and returns true, or returns false when
 * they've hit the hourly limit. Fails open if the usage table is unavailable
 * so a missing migration never breaks fact generation.
 */
export async function consumeAiQuota(userId: string, kind: string): Promise<boolean> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabaseAdmin
    .from("ai_usage")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", since);
  if (error) {
    console.warn("[ai-quota] usage check failed, allowing:", error.message);
    return true;
  }
  if ((count ?? 0) >= MAX_PER_WINDOW) return false;
  await supabaseAdmin.from("ai_usage").insert({ user_id: userId, kind });
  return true;
}
