import { describe, it, expect } from "vitest";
import { awardAmountForUser } from "./vipStatus";
import { decidePlus, entitlementFromRevenueCat, NO_PLUS, paddleEnv } from "./plus.server";

const ctx = { supabase: {} as never, userId: "user-1" };
const day = 86400_000;
const future = new Date(Date.now() + 30 * day).toISOString();
const past = new Date(Date.now() - day).toISOString();

describe("awardAmountForUser", () => {
  it("gives everyone the same coins (Plus doesn't multiply them)", async () => {
    await expect(awardAmountForUser(ctx, 100)).resolves.toBe(50);
    await expect(awardAmountForUser(ctx, 25)).resolves.toBe(13);
  });
});

describe("decidePlus", () => {
  const paddle = (status: string, end: string | null, cancel = false) => ({
    status,
    current_period_end: end,
    cancel_at_period_end: cancel,
  });
  const store = (expires: string | null, s = "app_store") => ({
    expires_at: expires,
    store: s,
    will_renew: true,
    billing_issue: false,
  });

  it("is off with no subscriptions", () => {
    expect(decidePlus(null, null)).toEqual(NO_PLUS);
  });

  it("is on for an active or trialing website subscription", () => {
    expect(decidePlus(paddle("active", future), null)).toMatchObject({
      active: true,
      source: "web",
    });
    expect(decidePlus(paddle("trialing", future), null).active).toBe(true);
  });

  it("is off when the website period has ended or it was cancelled", () => {
    expect(decidePlus(paddle("active", past), null).active).toBe(false);
    expect(decidePlus(paddle("canceled", future), null).active).toBe(false);
  });

  it("reports a cancelled-but-running website subscription as not renewing", () => {
    expect(decidePlus(paddle("active", future, true), null)).toMatchObject({
      active: true,
      will_renew: false,
    });
  });

  it("is on for an unexpired app-store subscription", () => {
    expect(decidePlus(null, store(future, "play_store"))).toMatchObject({
      active: true,
      source: "play_store",
    });
  });

  it("is off once the app-store subscription has expired", () => {
    expect(decidePlus(null, store(past)).active).toBe(false);
  });
});

describe("entitlementFromRevenueCat", () => {
  it("returns null when the subscriber never had Plus", () => {
    expect(entitlementFromRevenueCat({ subscriber: { entitlements: {} } })).toBeNull();
  });

  it("reads expiry, store, cancellation and billing issues", () => {
    const row = entitlementFromRevenueCat({
      subscriber: {
        entitlements: {
          why_plus_pro: { expires_date: future, product_identifier: "why_plus_monthly" },
        },
        subscriptions: {
          why_plus_monthly: {
            store: "play_store",
            unsubscribe_detected_at: past,
            billing_issues_detected_at: null,
          },
        },
      },
    });
    expect(row).toEqual({
      product_id: "why_plus_monthly",
      store: "play_store",
      expires_at: future,
      will_renew: false,
      billing_issue: false,
    });
  });

  it("ignores Test Store purchases unless testing is switched on", () => {
    const body = {
      subscriber: {
        entitlements: {
          why_plus_pro: { expires_date: future, product_identifier: "why_plus_monthly" },
        },
        subscriptions: { why_plus_monthly: { store: "test_store" } },
      },
    };
    expect(entitlementFromRevenueCat(body)).toBeNull();
    expect(entitlementFromRevenueCat(body, { allowTestStore: true })?.store).toBe("test_store");
  });

  it("ignores entitlements other than why_plus_pro", () => {
    expect(
      entitlementFromRevenueCat({
        subscriber: { entitlements: { plus: { expires_date: future, product_identifier: "x" } } },
      }),
    ).toBeNull();
  });

  it("uses the grace period expiry while a store retries payment", () => {
    const grace = new Date(Date.now() + 3 * day).toISOString();
    const row = entitlementFromRevenueCat({
      subscriber: {
        entitlements: {
          why_plus_pro: {
            expires_date: past,
            grace_period_expires_date: grace,
            product_identifier: "p",
          },
        },
        subscriptions: { p: { store: "app_store", billing_issues_detected_at: past } },
      },
    });
    expect(row?.expires_at).toBe(grace);
    expect(row?.billing_issue).toBe(true);
  });
});

describe("paddleEnv", () => {
  it("uses sandbox for a test client token and live otherwise", () => {
    expect(paddleEnv("test_abc")).toBe("sandbox");
    expect(paddleEnv("live_abc")).toBe("live");
    expect(paddleEnv(undefined)).toBe("live");
  });
});
