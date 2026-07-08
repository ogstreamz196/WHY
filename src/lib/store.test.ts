import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  completeDailyChallenge,
  getPoints,
  getStreak,
  hasCompletedDailyChallenge,
} from "./store";

// Wall-clock helpers so we can jump between days deterministically.
function setToday(iso: string) {
  vi.setSystemTime(new Date(iso));
}

describe("Daily Challenge — points & streak", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.useFakeTimers();
    setToday("2026-07-08T09:00:00Z");
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("awards exactly +25 points on the first completion of the day", () => {
    expect(getPoints()).toBe(0);
    const r = completeDailyChallenge();
    expect(r.awarded).toBe(true);
    expect(r.pointsDelta).toBe(25);
    expect(getPoints()).toBe(25);
    expect(hasCompletedDailyChallenge()).toBe(true);
  });

  it("does not award again the same day, even after many calls", () => {
    completeDailyChallenge();
    for (let i = 0; i < 10; i++) {
      const r = completeDailyChallenge();
      expect(r.awarded).toBe(false);
      expect(r.pointsDelta).toBe(0);
    }
    expect(getPoints()).toBe(25); // still exactly +25 across the whole day
  });

  it("starts the streak at 1 on the very first completion", () => {
    expect(getStreak()).toBe(0);
    const r = completeDailyChallenge();
    expect(r.streak).toBe(1);
    expect(getStreak()).toBe(1);
  });

  it("advances the streak by one when completed on consecutive days", () => {
    completeDailyChallenge();               // day 1  → 1
    setToday("2026-07-09T09:00:00Z");
    completeDailyChallenge();               // day 2  → 2
    setToday("2026-07-10T09:00:00Z");
    const r = completeDailyChallenge();     // day 3  → 3
    expect(r.streak).toBe(3);
    expect(getPoints()).toBe(75);
  });

  it("resets the streak to 1 when a day is missed", () => {
    completeDailyChallenge();               // day 1
    setToday("2026-07-09T09:00:00Z");
    completeDailyChallenge();               // day 2 → streak 2
    // skip July 10
    setToday("2026-07-11T09:00:00Z");
    const r = completeDailyChallenge();     // gap → reset
    expect(r.streak).toBe(1);
    expect(getPoints()).toBe(75); // 25 * 3 completions
  });

  it("hasCompletedDailyChallenge flips false at midnight (next day)", () => {
    completeDailyChallenge();
    expect(hasCompletedDailyChallenge()).toBe(true);
    setToday("2026-07-09T00:05:00Z");
    expect(hasCompletedDailyChallenge()).toBe(false);
    const r = completeDailyChallenge();
    expect(r.awarded).toBe(true);
    expect(r.streak).toBe(2);
  });
});
