import { describe, expect, it } from "vitest";
import {
  DROP_ITEM_IDS,
  OUTFIT_SLOTS,
  rarityOf,
  rollDailyReward,
  sanitizeOutfit,
  weeklyDropId,
} from "./avatarItems";
import { STORE_CATALOG, purchaseItem } from "./store";

/** A fixed sequence of "random" numbers. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("avatar catalog", () => {
  it("has unique item ids", () => {
    const ids = STORE_CATALOG.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has things to buy in every outfit slot", () => {
    for (const slot of OUTFIT_SLOTS) {
      expect(STORE_CATALOG.some((i) => i.category === slot && i.cost > 0)).toBe(true);
    }
  });

  it("never sells drop items for coins", () => {
    const drop = STORE_CATALOG.find((i) => i.dropOnly)!;
    expect(purchaseItem(drop.id)).toEqual({ ok: false, reason: "not_found" });
    expect(rarityOf(drop)).toBe("legendary");
  });
});

describe("weeklyDropId", () => {
  it("stays the same all week and changes the next week", () => {
    const monday = new Date("2026-10-12T00:00:00Z");
    const sunday = new Date("2026-10-18T23:59:00Z");
    const nextMonday = new Date("2026-10-19T00:00:00Z");
    expect(weeklyDropId(monday)).toBe(weeklyDropId(sunday));
    expect(weeklyDropId(nextMonday)).not.toBe(weeklyDropId(monday));
    expect(DROP_ITEM_IDS).toContain(weeklyDropId(monday));
  });
});

describe("rollDailyReward", () => {
  it("usually gives bonus coins", () => {
    expect(rollDailyReward([], STORE_CATALOG, seq(0.9, 0))).toEqual({ kind: "coins", amount: 5 });
  });

  it("sometimes gives an item the player doesn't own", () => {
    const r = rollDailyReward([], STORE_CATALOG, seq(0.1, 0.9, 0));
    expect(r.kind).toBe("item");
    const item = STORE_CATALOG.find((i) => r.kind === "item" && i.id === r.itemId)!;
    expect(item.vipOnly).toBeFalsy();
    expect(item.category).not.toBe("theme");
  });

  it("can give a special drop", () => {
    const r = rollDailyReward([], STORE_CATALOG, seq(0.1, 0.1, 0));
    expect(r.kind === "item" && DROP_ITEM_IDS.includes(r.itemId)).toBe(true);
  });

  it("falls back to coins when everything is owned", () => {
    const all = STORE_CATALOG.map((i) => i.id);
    expect(rollDailyReward(all, STORE_CATALOG, seq(0.1, 0)).kind).toBe("coins");
  });
});

describe("sanitizeOutfit", () => {
  it("keeps real items in the right slot and drops the rest", () => {
    expect(
      sanitizeOutfit(
        { hat: "hat-crown", hand: "hat-cap", face: "nope", pet: 5, extra: "hand-rose" },
        STORE_CATALOG,
      ),
    ).toEqual({ hat: "hat-crown" });
    expect(sanitizeOutfit(null, STORE_CATALOG)).toEqual({});
  });
});
