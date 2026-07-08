import { describe, it, expect } from "vitest";
import { computeCoinDrop, GLOBAL_COIN_MULTIPLIER, VIP_COIN_MULTIPLIER } from "./coinDrop";

describe("computeCoinDrop", () => {
  it("halves the base drop for non-VIP users", () => {
    expect(computeCoinDrop(100)).toBe(50);
    expect(computeCoinDrop(25)).toBe(13); // 12.5 rounds to 13
    expect(computeCoinDrop(1)).toBe(1); // 0.5 rounds to 1
  });

  it("applies the VIP multiplier on top of the reduced base", () => {
    // 100 * 0.5 * 2 = 100 (net: VIPs earn what everyone used to earn)
    expect(computeCoinDrop(100, { isVip: true })).toBe(100);
    expect(computeCoinDrop(25, { isVip: true })).toBe(25);
  });

  it("VIP earns exactly 2x a free user's drop", () => {
    for (const base of [10, 33, 77, 250, 1000]) {
      const free = computeCoinDrop(base);
      const vip = computeCoinDrop(base, { isVip: true });
      expect(vip).toBe(free * 2);
    }
  });

  it("supports higher VIP tiers via vipMultiplier override", () => {
    expect(computeCoinDrop(100, { isVip: true, vipMultiplier: 3 })).toBe(150);
    expect(computeCoinDrop(100, { isVip: true, vipMultiplier: 4 })).toBe(200);
  });

  it("ignores vipMultiplier when isVip is false", () => {
    expect(computeCoinDrop(100, { isVip: false, vipMultiplier: 10 })).toBe(50);
  });

  it("returns 0 for non-positive / invalid input", () => {
    expect(computeCoinDrop(0)).toBe(0);
    expect(computeCoinDrop(-10, { isVip: true })).toBe(0);
    expect(computeCoinDrop(Number.NaN)).toBe(0);
    expect(computeCoinDrop(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("exposes the tuning constants", () => {
    expect(GLOBAL_COIN_MULTIPLIER).toBe(0.5);
    expect(VIP_COIN_MULTIPLIER).toBe(2);
  });
});
