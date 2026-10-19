import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  claimWeeklyDrop,
  getMyInventory,
  getMyProfile,
  updateMyProfile,
  type ProfileDTO,
} from "@/lib/account.functions";
import { OUTFIT_SLOTS, weeklyDropId, type Outfit, type OutfitSlot } from "@/lib/avatarItems";
import {
  getEquipped,
  getInventory,
  grantLocalItem,
  itemById,
  setEquipped,
  setOwnedItems,
  wearItem,
  type Equipped,
  type StoreItem,
} from "@/lib/store";

/** This device's saved avatar, kept current when the store changes it. */
function useLocalEquipped(): Equipped {
  const [eq, setEq] = useState<Equipped>({ avatar: "avatar-sprout", outfit: {} });
  useEffect(() => {
    const sync = () => setEq(getEquipped());
    sync();
    window.addEventListener("why:equipped-change", sync);
    return () => window.removeEventListener("why:equipped-change", sync);
  }, []);
  return eq;
}

/**
 * The player's avatar and outfit. Signed-in players use their profile on the
 * server (shared with the Ranks page); guests use this device.
 */
export function useMyAvatar(userId: string | null): {
  avatarId: string;
  outfit: Outfit;
} {
  const fetchProfile = useServerFn(getMyProfile);
  const local = useLocalEquipped();
  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: !!userId,
  });

  // Keep this device's copy in step with the server so the store preview
  // starts from what the player is really wearing.
  const server = userId ? profile.data : null;
  useEffect(() => {
    if (!server) return;
    const cur = getEquipped();
    if (
      cur.avatar !== server.avatar_id ||
      JSON.stringify(cur.outfit ?? {}) !== JSON.stringify(server.avatar_outfit ?? {})
    ) {
      setEquipped({ avatar: server.avatar_id, outfit: server.avatar_outfit ?? {} });
    }
  }, [server]);

  if (server) return { avatarId: server.avatar_id, outfit: server.avatar_outfit ?? {} };
  return { avatarId: local.avatar ?? "avatar-sprout", outfit: local.outfit ?? {} };
}

export type WeeklyDrop = {
  item: StoreItem;
  claimed: boolean;
  claim: () => Promise<boolean>;
};

/** This week's free special item, and whether the player already has it. */
export function useWeeklyDrop(userId: string | null): WeeklyDrop | null {
  const qc = useQueryClient();
  const fetchInventory = useServerFn(getMyInventory);
  const doClaim = useServerFn(claimWeeklyDrop);
  const [localOwned, setLocalOwned] = useState<string[]>([]);
  useEffect(() => setLocalOwned(getInventory()), []);
  const inventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetchInventory(),
    enabled: !!userId,
  });

  const item = itemById(weeklyDropId());
  if (!item) return null;
  const owned = userId ? (inventory.data ?? null) : localOwned;
  // Until the server answers, don't offer a claim.
  const claimed = owned === null ? true : owned.includes(item.id);

  return {
    item,
    claimed,
    claim: async () => {
      if (!userId) {
        grantLocalItem(item.id);
        setLocalOwned(getInventory());
        return true;
      }
      const res = await doClaim();
      const next = await qc.fetchQuery({
        queryKey: ["inventory"],
        queryFn: () => fetchInventory(),
      });
      setOwnedItems(next);
      return res.ok;
    },
  };
}

const isSlot = (c: string): c is OutfitSlot => (OUTFIT_SLOTS as readonly string[]).includes(c);

/**
 * Put on (or take off) a character or wearable. Changes this device straight
 * away and, for signed-in players, saves it to their profile so it shows on
 * the Ranks page. Throws (after undoing the change) if the server says no.
 */
export function useDressUp(userId: string | null) {
  const qc = useQueryClient();
  const update = useServerFn(updateMyProfile);

  return async (item: StoreItem, on = true): Promise<void> => {
    const before = getEquipped();
    let data: { avatar_id?: string; avatar_outfit?: Outfit };
    if (item.category === "avatar") {
      setEquipped({ avatar: item.id });
      data = { avatar_id: item.id };
    } else if (isSlot(item.category)) {
      const next = wearItem(item.category, on ? item.id : null);
      data = { avatar_outfit: next.outfit ?? {} };
    } else {
      return;
    }
    if (!userId) return;

    const prev = qc.getQueryData<ProfileDTO | null>(["profile"]);
    if (prev) {
      qc.setQueryData<ProfileDTO>(["profile"], {
        ...prev,
        ...(data.avatar_id ? { avatar_id: data.avatar_id } : {}),
        ...(data.avatar_outfit ? { avatar_outfit: data.avatar_outfit } : {}),
      });
    }
    try {
      const saved = await update({ data });
      qc.setQueryData(["profile"], saved);
      // The server may take off pieces this player can't wear (Plus items
      // after Plus ends); keep this device in step with what was saved.
      if (data.avatar_outfit && saved?.avatar_outfit) {
        setEquipped({ outfit: saved.avatar_outfit });
      }
      void qc.invalidateQueries({ queryKey: ["player-profile"] });
      void qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (e) {
      setEquipped({ avatar: before.avatar, outfit: before.outfit });
      qc.setQueryData(["profile"], prev);
      throw e;
    }
  };
}
