// Why? Plus status. A user has Plus if either
//   - a website (Paddle) subscription is active or trialing, or
//   - an app-store subscription synced from RevenueCat (plus_entitlements)
//     hasn't expired.
// Everything that depends on Plus asks getPlusStatus(). See docs/WHY_PLUS.md.

export type PlusSource = "web" | "app_store" | "play_store" | "store";

export type PlusStatus = {
  active: boolean;
  source: PlusSource | null;
  expires_at: string | null;
  /** False once the subscriber has cancelled (Plus lasts until expires_at). */
  will_renew: boolean;
  billing_issue: boolean;
};

export const NO_PLUS: PlusStatus = {
  active: false,
  source: null,
  expires_at: null,
  will_renew: false,
  billing_issue: false,
};

/** RevenueCat entitlement identifier that unlocks Plus. */
export const PLUS_ENTITLEMENT = "why_plus_pro";

type PaddleRow = {
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean | null;
} | null;

type StoreRow = {
  expires_at: string | null;
  store: string | null;
  will_renew: boolean;
  billing_issue: boolean;
} | null;

/** Pure decision used by getPlusStatus; exported for tests. */
export function decidePlus(paddle: PaddleRow, store: StoreRow, now = Date.now()): PlusStatus {
  const notExpired = (iso: string | null) => !iso || new Date(iso).getTime() > now;

  if (store && notExpired(store.expires_at)) {
    return {
      active: true,
      source: store.store === "app_store" || store.store === "play_store" ? store.store : "store",
      expires_at: store.expires_at,
      will_renew: store.will_renew,
      billing_issue: store.billing_issue,
    };
  }
  if (
    paddle &&
    (paddle.status === "active" || paddle.status === "trialing") &&
    notExpired(paddle.current_period_end)
  ) {
    return {
      active: true,
      source: "web",
      expires_at: paddle.current_period_end,
      will_renew: !paddle.cancel_at_period_end,
      billing_issue: false,
    };
  }
  return NO_PLUS;
}

function paddleEnv(): "sandbox" | "live" {
  return (process.env.VITE_PAYMENTS_CLIENT_TOKEN ?? "").startsWith("test_") ? "sandbox" : "live";
}

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function getPlusStatus(userId: string): Promise<PlusStatus> {
  const db = await admin();
  const [paddleRes, storeRes] = await Promise.all([
    db
      .from("subscriptions")
      .select("status, current_period_end, cancel_at_period_end")
      .eq("user_id", userId)
      .eq("environment", paddleEnv())
      .in("status", ["active", "trialing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("plus_entitlements")
      .select("expires_at, store, will_renew, billing_issue")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  // A missing plus_entitlements table (migration not applied yet) must not
  // take away website subscribers' Plus.
  if (storeRes.error)
    console.warn("[plus] store entitlement lookup failed:", storeRes.error.message);
  return decidePlus(paddleRes.data ?? null, storeRes.error ? null : (storeRes.data ?? null));
}

/** The parts of a RevenueCat v1 subscriber response we use. */
type RcSubscriber = {
  subscriber?: {
    entitlements?: Record<
      string,
      {
        expires_date: string | null;
        grace_period_expires_date?: string | null;
        product_identifier?: string;
      }
    >;
    subscriptions?: Record<
      string,
      {
        store?: string;
        unsubscribe_detected_at?: string | null;
        billing_issues_detected_at?: string | null;
      }
    >;
  };
};

/** Turn a RevenueCat subscriber into a plus_entitlements row (null = never had Plus). */
export function entitlementFromRevenueCat(
  body: RcSubscriber,
  opts: { allowTestStore?: boolean } = {},
): {
  product_id: string | null;
  store: string | null;
  expires_at: string | null;
  will_renew: boolean;
  billing_issue: boolean;
} | null {
  const ent = body.subscriber?.entitlements?.[PLUS_ENTITLEMENT];
  if (!ent) return null;
  const product = ent.product_identifier ?? null;
  const sub = product ? body.subscriber?.subscriptions?.[product] : undefined;
  // Store billing grace periods keep access while a payment is retried.
  const expires = ent.grace_period_expires_date ?? ent.expires_date ?? null;
  // RevenueCat Test Store purchases are free and simulated (debug builds). They
  // only count when REVENUECAT_ALLOW_TEST_STORE=true, never by accident.
  if (sub?.store === "test_store" && !opts.allowTestStore) return null;
  return {
    product_id: product,
    store: sub?.store ?? null,
    expires_at: expires,
    will_renew: !sub?.unsubscribe_detected_at,
    billing_issue: !!sub?.billing_issues_detected_at,
  };
}

/**
 * Re-read a subscriber from RevenueCat and store their Plus state. Safe to
 * call any number of times, in any order (webhooks can repeat or arrive late).
 */
export async function syncRevenueCat(userId: string): Promise<void> {
  const key = process.env.REVENUECAT_SECRET_API_KEY;
  if (!key) throw new Error("REVENUECAT_SECRET_API_KEY is not configured");
  const res = await fetch(
    `https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(userId)}`,
    { headers: { Authorization: `Bearer ${key}`, Accept: "application/json" } },
  );
  if (!res.ok) throw new Error(`RevenueCat subscriber lookup failed [${res.status}]`);
  const row = entitlementFromRevenueCat((await res.json()) as RcSubscriber, {
    allowTestStore: process.env.REVENUECAT_ALLOW_TEST_STORE === "true",
  });
  const db = await admin();
  if (!row) {
    await db.from("plus_entitlements").delete().eq("user_id", userId);
    return;
  }
  const { error } = await db
    .from("plus_entitlements")
    .upsert(
      { user_id: userId, ...row, updated_at: new Date().toISOString() },
      { onConflict: "user_id" },
    );
  if (error) throw new Error(error.message);
}

/** Which of these users have Plus right now (for badges on boards and profiles). */
export async function plusUserIds(userIds: string[]): Promise<Set<string>> {
  const set = new Set<string>();
  if (userIds.length === 0) return set;
  const db = await admin();
  const now = Date.now();
  const live = (iso: string | null) => !iso || new Date(iso).getTime() > now;
  const [paddleRes, storeRes] = await Promise.all([
    db
      .from("subscriptions")
      .select("user_id, current_period_end")
      .in("user_id", userIds)
      .eq("environment", paddleEnv())
      .in("status", ["active", "trialing"]),
    db.from("plus_entitlements").select("user_id, expires_at").in("user_id", userIds),
  ]);
  for (const r of paddleRes.data ?? []) if (live(r.current_period_end)) set.add(r.user_id);
  if (!storeRes.error)
    for (const r of storeRes.data ?? []) if (live(r.expires_at)) set.add(r.user_id);
  return set;
}
