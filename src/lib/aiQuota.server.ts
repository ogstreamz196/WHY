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

/** The signed-in user's id if the request carries a valid Supabase token, else null. */
export async function optionalUserId(): Promise<string | null> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const header = getRequest()?.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length);
  if (token.split(".").length !== 3) return null;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

// Guests have no account to log usage against, so they get a smaller
// in-memory allowance per IP. It resets when the server instance recycles,
// which is fine for its purpose: a brake on runaway AI spend.
const GUEST_MAX_PER_WINDOW = 15;
const guestHits = new Map<string, number[]>();

export async function consumeGuestAiQuota(): Promise<boolean> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const headers = getRequest()?.headers;
  const ip =
    headers?.get("cf-connecting-ip") ??
    headers?.get("x-real-ip") ??
    headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const now = Date.now();
  const recent = (guestHits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= GUEST_MAX_PER_WINDOW) {
    guestHits.set(ip, recent);
    return false;
  }
  recent.push(now);
  guestHits.set(ip, recent);
  if (guestHits.size > 5000) guestHits.clear();
  return true;
}
