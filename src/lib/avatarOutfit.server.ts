// Reading and saving what each player's avatar is wearing
// (profiles.avatar_outfit). Reads never fail: if the column isn't there yet
// (migration not applied) everyone simply shows without an outfit.
import { sanitizeOutfit, type Outfit } from "./avatarItems";
import { STORE_CATALOG } from "./store";

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type OutfitRow = { id: string; avatar_outfit: unknown };

// Ids per query: keeps the request URL well under PostgREST's limit.
const BATCH = 150;

/** Outfits for a list of players, keyed by user id. Missing players get nothing. */
export async function readOutfits(userIds: string[]): Promise<Record<string, Outfit>> {
  const ids = Array.from(new Set(userIds)).filter(Boolean);
  const out: Record<string, Outfit> = {};
  if (ids.length === 0) return out;
  const client = await db();
  const batches: string[][] = [];
  for (let i = 0; i < ids.length; i += BATCH) batches.push(ids.slice(i, i + BATCH));
  await Promise.all(
    batches.map(async (batch) => {
      try {
        const { data, error } = await client
          .from("profiles")
          .select("id, avatar_outfit")
          .in("id", batch);
        if (error) return;
        for (const row of (data ?? []) as OutfitRow[]) {
          out[row.id] = sanitizeOutfit(row.avatar_outfit, STORE_CATALOG);
        }
      } catch {
        /* show these players without outfits */
      }
    }),
  );
  return out;
}

export async function readOutfit(userId: string): Promise<Outfit> {
  return (await readOutfits([userId]))[userId] ?? {};
}

/**
 * Save an outfit after checking the player may wear every piece: free items
 * for everyone, Plus items for Plus members, everything else must be owned.
 */
export async function saveOutfit(
  userId: string,
  requested: unknown,
  isPlus: () => Promise<boolean>,
): Promise<Outfit> {
  const outfit = sanitizeOutfit(requested, STORE_CATALOG);
  const ids = Object.values(outfit);
  const items = ids.map((id) => STORE_CATALOG.find((i) => i.id === id)!);

  if (items.some((i) => i.vipOnly) && !(await isPlus())) {
    throw new Error("That item is for Why? Plus members.");
  }
  const needOwnership = items.filter((i) => !i.vipOnly && (i.cost > 0 || i.dropOnly));
  if (needOwnership.length > 0) {
    const { data, error } = await (
      await db()
    )
      .from("user_inventory")
      .select("item_id")
      .eq("user_id", userId)
      .in(
        "item_id",
        needOwnership.map((i) => i.id),
      );
    if (error) throw new Error(error.message);
    const owned = new Set((data ?? []).map((r) => r.item_id));
    const missing = needOwnership.find((i) => !owned.has(i.id));
    if (missing) throw new Error(`You don't own ${missing.name} yet.`);
  }

  const { error } = await (
    await db()
  )
    .from("profiles")
    .update({ avatar_outfit: outfit, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw new Error("Outfits can't be saved right now. Please try again later.");
  return outfit;
}
