import { describe, it, expect, beforeEach } from "vitest";
import {
  shouldShow,
  markShown,
  markDismissed,
  DISMISS_DAYS,
  OPENS_BETWEEN,
  MAX_PROMPTS,
  DAY_MS,
} from "@/lib/linkGoogleCadence";

function memStore() {
  const map = new Map<string, string>();
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    _map: map,
  };
}

const UID = "user-1";

describe("LinkGoogleBanner cadence", () => {
  let store: ReturnType<typeof memStore>;
  beforeEach(() => {
    store = memStore();
  });

  it("shows only once every OPENS_BETWEEN opens", () => {
    const results: boolean[] = [];
    for (let i = 0; i < OPENS_BETWEEN * 2; i++) {
      results.push(shouldShow(UID, store));
    }
    // opens: 1..6 → true at 3 and 6 (every OPENS_BETWEEN-th)
    const trues = results.filter(Boolean).length;
    expect(trues).toBe(2);
    expect(results[OPENS_BETWEEN - 1]).toBe(true);
  });

  it("hides for DISMISS_DAYS after dismissal, then re-appears", () => {
    const t0 = 1_000_000_000_000;
    markDismissed(UID, store, t0);
    // Still within window — never true even on the OPENS_BETWEEN-th check.
    for (let i = 0; i < OPENS_BETWEEN; i++) {
      expect(shouldShow(UID, store, t0 + 60_000)).toBe(false);
    }
    // Past the dismissal window — cadence resumes.
    const after = t0 + DISMISS_DAYS * DAY_MS + 1;
    const seen: boolean[] = [];
    for (let i = 0; i < OPENS_BETWEEN; i++) {
      seen.push(shouldShow(UID, store, after));
    }
    expect(seen.some(Boolean)).toBe(true);
  });

  it("stops showing after MAX_PROMPTS calls to markShown", () => {
    for (let i = 0; i < MAX_PROMPTS; i++) markShown(UID, store);
    // Even after cadence would allow, cap enforces silence.
    for (let i = 0; i < OPENS_BETWEEN * 3; i++) {
      expect(shouldShow(UID, store)).toBe(false);
    }
  });

  it("scopes counters per user", () => {
    for (let i = 0; i < OPENS_BETWEEN; i++) shouldShow("a", store);
    // user "b" starts fresh — first two calls false, third true.
    expect(shouldShow("b", store)).toBe(false);
    expect(shouldShow("b", store)).toBe(false);
    expect(shouldShow("b", store)).toBe(true);
  });

  it("returns false when storage throws", () => {
    const brokenStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {},
    };
    expect(shouldShow(UID, brokenStore)).toBe(false);
  });
});
