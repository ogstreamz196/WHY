// Guest progress lives in this device's storage (see src/lib/store.ts). Only
// favourites carry over to an account (see migrateGuestData), so they decide
// whether to offer the import screen after sign-in.
import { getFavorites } from "@/lib/store";

const GUEST_KEYS = ["why:favorites", "why:points", "why:streak"] as const;

export function hasGuestFavorites(): boolean {
  try {
    return getFavorites().length > 0;
  } catch {
    return false;
  }
}

/** Forget the guest snapshot after a successful import so we don't ask again. */
export function clearGuestSnapshot(): void {
  if (typeof window === "undefined") return;
  // Older builds kept guest data in sessionStorage, and store.ts copies it
  // back into localStorage on load, so clear both.
  for (const getStore of [() => window.localStorage, () => window.sessionStorage]) {
    try {
      const s = getStore();
      for (const k of GUEST_KEYS) s.removeItem(k);
    } catch {
      // storage blocked — ignore
    }
  }
}
