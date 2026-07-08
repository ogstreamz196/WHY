import { describe, it, expect, beforeEach, vi } from "vitest";
import { isVipUser, awardAmountForUser } from "./vipStatus";

type MockRow = { status: string; current_period_end: string | null } | null;

function makeCtx(row: MockRow) {
  const query = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue({ data: row, error: null }),
  };
  const supabase = { from: vi.fn().mockReturnValue(query) };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { ctx: { supabase: supabase as any, userId: "user-1" }, query, supabase };
}

describe("isVipUser", () => {
  beforeEach(() => {
    process.env.VITE_PAYMENTS_CLIENT_TOKEN = "test_abc123";
  });

  it("returns false when the user has no subscription row", async () => {
    const { ctx, supabase } = makeCtx(null);
    await expect(isVipUser(ctx)).resolves.toBe(false);
    expect(supabase.from).toHaveBeenCalledWith("subscriptions");
  });

  it("returns true for an active subscription that has not expired", async () => {
    const future = new Date(Date.now() + 30 * 86400_000).toISOString();
    const { ctx } = makeCtx({ status: "active", current_period_end: future });
    await expect(isVipUser(ctx)).resolves.toBe(true);
  });

  it("returns true for a trialing subscription", async () => {
    const future = new Date(Date.now() + 7 * 86400_000).toISOString();
    const { ctx } = makeCtx({ status: "trialing", current_period_end: future });
    await expect(isVipUser(ctx)).resolves.toBe(true);
  });

  it("returns false when the period has already ended", async () => {
    const past = new Date(Date.now() - 86400_000).toISOString();
    const { ctx } = makeCtx({ status: "active", current_period_end: past });
    await expect(isVipUser(ctx)).resolves.toBe(false);
  });

  it("filters by the current Paddle environment", async () => {
    const { ctx, query } = makeCtx(null);
    await isVipUser(ctx);
    // sandbox env because token starts with "test_"
    expect(query.eq).toHaveBeenCalledWith("environment", "sandbox");
    expect(query.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(query.in).toHaveBeenCalledWith("status", ["active", "trialing"]);
  });
});

describe("awardAmountForUser", () => {
  beforeEach(() => {
    process.env.VITE_PAYMENTS_CLIENT_TOKEN = "test_abc123";
  });

  it("halves the base drop for non-VIP users", async () => {
    const { ctx } = makeCtx(null);
    await expect(awardAmountForUser(ctx, 100)).resolves.toBe(50);
  });

  it("gives VIP users the full base (0.5 × 2)", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    const { ctx } = makeCtx({ status: "active", current_period_end: future });
    await expect(awardAmountForUser(ctx, 100)).resolves.toBe(100);
  });

  it("VIP earns exactly 2× a free user for the same base", async () => {
    const future = new Date(Date.now() + 86400_000).toISOString();
    for (const base of [10, 32, 76, 250, 1000]) {
      const free = await awardAmountForUser(makeCtx(null).ctx, base);
      const vip = await awardAmountForUser(
        makeCtx({ status: "active", current_period_end: future }).ctx,
        base,
      );
      expect(vip).toBe(free * 2);
    }
  });

  it("canceled subscription drops back to non-VIP amount", async () => {
    const { ctx } = makeCtx(null); // canceled rows are filtered out by .in()
    await expect(awardAmountForUser(ctx, 200)).resolves.toBe(100);
  });
});
