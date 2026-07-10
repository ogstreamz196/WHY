// Pure cadence helpers for the Gmail→Google linking prompt.
// Extracted so behaviour is unit-testable without React/Supabase.

export const DISMISS_DAYS = 14;
export const OPENS_BETWEEN = 3;
export const MAX_PROMPTS = 5;
export const DAY_MS = 86_400_000;

type Store = Pick<Storage, "getItem" | "setItem">;

function keyFor(uid: string, k: string): string {
  return `why:linkgoogle:${uid}:${k}`;
}

function num(store: Store, uid: string, k: string): number {
  return Number(store.getItem(keyFor(uid, k)) || 0);
}

/**
 * Decide whether the banner should show for `uid`. Also increments the
 * per-user "opens" counter so cadence advances on every check.
 */
export function shouldShow(uid: string, store: Store, now: number = Date.now()): boolean {
  try {
    const dismissedAt = num(store, uid, "dismissedAt");
    if (dismissedAt && now - dismissedAt < DISMISS_DAYS * DAY_MS) return false;
    const shown = num(store, uid, "shown");
    if (shown >= MAX_PROMPTS) return false;
    const opens = num(store, uid, "opens") + 1;
    store.setItem(keyFor(uid, "opens"), String(opens));
    if (opens % OPENS_BETWEEN !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

export function markShown(uid: string, store: Store): void {
  try {
    const shown = num(store, uid, "shown") + 1;
    store.setItem(keyFor(uid, "shown"), String(shown));
  } catch {
    /* noop */
  }
}

export function markDismissed(uid: string, store: Store, now: number = Date.now()): void {
  try {
    store.setItem(keyFor(uid, "dismissedAt"), String(now));
  } catch {
    /* noop */
  }
}
