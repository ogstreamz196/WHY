// The birth month and year picked on the sign-up page, kept on this device
// while someone continues with Google or Apple (which leave the site), so it
// can be saved to their new account when they come back. Expires after a day.
const KEY = "why:pending-birth";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type PendingBirthDate = { year: number; month: number };

export function rememberPendingBirthDate(b: PendingBirthDate): void {
  try {
    localStorage.setItem(KEY, JSON.stringify({ ...b, at: Date.now() }));
  } catch {
    /* private mode: they'll be asked after signing in instead */
  }
}

export function takePendingBirthDate(): PendingBirthDate | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { year?: unknown; month?: unknown; at?: unknown };
    const fresh = typeof v.at === "number" && Date.now() - v.at < MAX_AGE_MS;
    if (!fresh || typeof v.year !== "number" || typeof v.month !== "number") {
      localStorage.removeItem(KEY);
      return null;
    }
    return { year: v.year, month: v.month };
  } catch {
    return null;
  }
}

export function clearPendingBirthDate(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
