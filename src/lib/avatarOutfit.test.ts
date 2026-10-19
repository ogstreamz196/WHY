import { describe, expect, it, vi } from "vitest";

const updateSpy = vi.fn();

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({
          in: async (_col: string, ids: string[]) => ({
            data: ids.map((item_id) => ({ item_id })),
            error: null,
          }),
        }),
      }),
      update: (patch: unknown) => {
        updateSpy(patch);
        return { eq: async () => ({ error: null }) };
      },
    }),
  },
}));

// The live catalog has no Plus-only wearables yet; add one so the rule is covered.
vi.mock("./store", async (importOriginal) => {
  const mod = await importOriginal<typeof import("./store")>();
  return {
    ...mod,
    STORE_CATALOG: [
      ...mod.STORE_CATALOG,
      {
        id: "test-plus-hat",
        category: "hat",
        name: "Test Plus hat",
        emoji: "🎩",
        description: "",
        cost: 0,
        vipOnly: true,
      },
    ],
  };
});

import { saveOutfit } from "./avatarOutfit.server";
import { STORE_CATALOG } from "./store";

const slots = ["hat", "face", "hand", "neck", "pet", "aura"];
const plusItem = STORE_CATALOG.find((i) => i.vipOnly && slots.includes(i.category));
// Any ordinary wearable in another slot (the stub says the player owns it).
const freeItem = STORE_CATALOG.find(
  (i) => !i.vipOnly && slots.includes(i.category) && i.category !== plusItem?.category,
);

describe("saveOutfit", () => {
  it.skipIf(!plusItem || !freeItem)(
    "takes off Plus items for non-members but keeps the rest",
    async () => {
      updateSpy.mockClear();
      const saved = await saveOutfit(
        "user-1",
        { [plusItem!.category]: plusItem!.id, [freeItem!.category]: freeItem!.id },
        async () => false,
      );
      expect(saved).toEqual({ [freeItem!.category]: freeItem!.id });
      expect(updateSpy).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_outfit: { [freeItem!.category]: freeItem!.id } }),
      );
    },
  );

  it.skipIf(!plusItem)("keeps Plus items for Plus members", async () => {
    const saved = await saveOutfit(
      "user-1",
      { [plusItem!.category]: plusItem!.id },
      async () => true,
    );
    expect(saved).toEqual({ [plusItem!.category]: plusItem!.id });
  });
});
