import { beforeEach, describe, expect, it, vi } from "vitest";

// Paddle: webhook verification and the current subscription are mocked.
const paddle = vi.hoisted(() => ({
  event: null as unknown,
  sub: null as unknown,
  get: vi.fn(),
}));
vi.mock("@/lib/paddle.server", () => ({
  EventName: {
    SubscriptionCreated: "subscription.created",
    SubscriptionUpdated: "subscription.updated",
    SubscriptionCanceled: "subscription.canceled",
    TransactionPaymentFailed: "transaction.payment_failed",
  },
  verifyWebhook: vi.fn(async () => paddle.event),
  getPaddleClient: () => ({
    subscriptions: { get: (id: string) => paddle.get(id) },
  }),
}));

// Supabase: records upserts/updates; `rows` says how many rows an update matched.
const db = vi.hoisted(() => ({
  upserts: [] as unknown[],
  updates: [] as unknown[],
  rows: 1,
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from: () => ({
      upsert: async (row: unknown) => {
        db.upserts.push(row);
        return { error: null };
      },
      update: (row: unknown) => {
        db.updates.push(row);
        const chain = {
          eq: () => chain,
          select: async () => ({
            error: null,
            data: Array.from({ length: db.rows }, (_, i) => ({ id: i })),
          }),
        };
        return chain;
      },
    }),
  }),
}));

import { Route } from "@/routes/api/public/payments/webhook";

const subscription = (over: Record<string, unknown> = {}) => ({
  id: "sub_1",
  status: "active",
  customerId: "ctm_1",
  customData: { userId: "user-1" },
  currentBillingPeriod: { startsAt: "2026-10-01T00:00:00Z", endsAt: "2026-11-01T00:00:00Z" },
  scheduledChange: null,
  items: [
    {
      price: { id: "pri_1", importMeta: { externalId: "plus_monthly" } },
      product: { id: "pro_1", importMeta: { externalId: "why_plus" } },
    },
  ],
  ...over,
});

async function post(eventType: string, data: Record<string, unknown>) {
  paddle.event = { eventType, data };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handlers = (Route.options as any).server.handlers;
  return handlers.POST({
    request: new Request("https://x/api/public/payments/webhook?env=sandbox", { method: "POST" }),
  }) as Promise<Response>;
}

beforeEach(() => {
  db.upserts = [];
  db.updates = [];
  db.rows = 1;
  paddle.get.mockReset();
});

describe("Paddle webhook", () => {
  it("stores Paddle's current state, not a late event's snapshot", async () => {
    // A retried "updated" event that still says active, after the sub was canceled.
    paddle.get.mockResolvedValue(subscription({ status: "canceled" }));
    const res = await post("subscription.updated", { id: "sub_1", status: "active" });
    expect(res.status).toBe(200);
    expect(paddle.get).toHaveBeenCalledWith("sub_1");
    expect(db.upserts).toEqual([
      expect.objectContaining({
        user_id: "user-1",
        paddle_subscription_id: "sub_1",
        status: "canceled",
        environment: "sandbox",
        price_id: "plus_monthly",
        product_id: "why_plus",
      }),
    ]);
  });

  it("creates the row when 'updated' arrives before 'created'", async () => {
    paddle.get.mockResolvedValue(subscription({ status: "trialing" }));
    await post("subscription.updated", { id: "sub_1" });
    expect(db.upserts).toEqual([expect.objectContaining({ status: "trialing" })]);
  });

  it("still revokes Plus on past_due", async () => {
    paddle.get.mockResolvedValue(subscription({ status: "past_due" }));
    await post("subscription.updated", { id: "sub_1" });
    expect(db.upserts).toEqual([expect.objectContaining({ status: "canceled" })]);
  });

  it("keeps an active subscription active after a failed payment", async () => {
    paddle.get.mockResolvedValue(subscription({ status: "active" }));
    await post("transaction.payment_failed", { id: "txn_1", subscriptionId: "sub_1" });
    expect(db.upserts).toEqual([expect.objectContaining({ status: "active" })]);
  });

  it("ignores failed payments that aren't for a subscription", async () => {
    await post("transaction.payment_failed", { id: "txn_1", subscriptionId: null });
    expect(paddle.get).not.toHaveBeenCalled();
    expect(db.upserts).toEqual([]);
    expect(db.updates).toEqual([]);
  });

  it("without a userId, updates the existing row and keeps its owner", async () => {
    paddle.get.mockResolvedValue(subscription({ status: "canceled", customData: null }));
    await post("subscription.canceled", { id: "sub_1" });
    expect(db.upserts).toEqual([]);
    expect(db.updates).toEqual([expect.objectContaining({ status: "canceled" })]);
    expect(db.updates[0]).not.toHaveProperty("user_id");
  });

  it("returns non-2xx when Paddle can't be reached, so Paddle retries", async () => {
    paddle.get.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await post("subscription.created", { id: "sub_1" });
    expect(res.status).toBe(400);
  });
});
