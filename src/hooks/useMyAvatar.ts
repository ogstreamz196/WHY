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
 * server (shared with the Ranks page); guests use this device. The account's
 * outfit is never written into the guest copy, so on a shared device signing
 * in or out doesn't change what the guest is wearing.
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

  const server = userId ? profile.data : null;
  if (server) return { avatarId: server.avatar_id, outfit: server.avatar_outfit ?? {} };
  // Signed in but no profile (yet): the default look, never the guest's.
  if (userId) return { avatarId: "avatar-sprout", outfit: {} };
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
      await qc.fetchQuery({
        queryKey: ["inventory"],
        queryFn: () => fetchInventory(),
      });
      return res.ok;
    },
  };
}

const isSlot = (c: string): c is OutfitSlot => (OUTFIT_SLOTS as readonly string[]).includes(c);

/**
 * Put on (or take off) a character or wearable. Guests change this device;
 * signed-in players change their profile (shown on the Ranks page) and never
 * the guest copy. Throws (after undoing the change) if the server says no.
 */
export function useDressUp(userId: string | null) {
  const qc = useQueryClient();
  const update = useServerFn(updateMyProfile);
  const fetchProfile = useServerFn(getMyProfile);

  return async (item: StoreItem, on = true): Promise<void> => {
    if (item.category !== "avatar" && !isSlot(item.category)) return;
    if (!userId) {
      if (item.category === "avatar") setEquipped({ avatar: item.id });
      else if (isSlot(item.category)) wearItem(item.category, on ? item.id : null);
      return;
    }

    const prev = await qc.ensureQueryData<ProfileDTO | null>({
      queryKey: ["profile"],
      queryFn: () => fetchProfile(),
    });
    let data: { avatar_id?: string; avatar_outfit?: Outfit };
    if (item.category === "avatar") {
      data = { avatar_id: item.id };
    } else {
      const outfit: Outfit = { ...(prev?.avatar_outfit ?? {}) };
      if (on) outfit[item.category as OutfitSlot] = item.id;
      else delete outfit[item.category as OutfitSlot];
      data = { avatar_outfit: outfit };
    }

    if (prev) {
      qc.setQueryData<ProfileDTO>(["profile"], {
        ...prev,
        ...(data.avatar_id ? { avatar_id: data.avatar_id } : {}),
        ...(data.avatar_outfit ? { avatar_outfit: data.avatar_outfit } : {}),
      });
    }
    try {
      // The server may take off pieces this player can't wear (Plus items
      // after Plus ends); what it saved is what we show.
      const saved = await update({ data });
      qc.setQueryData(["profile"], saved);
      void qc.invalidateQueries({ queryKey: ["player-profile"] });
      void qc.invalidateQueries({ queryKey: ["leaderboard"] });
    } catch (e) {
      qc.setQueryData(["profile"], prev);
      throw e;
    }
  };
}
