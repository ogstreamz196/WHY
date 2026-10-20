import { describe, it, expect } from "vitest";
import { scoreAnswer, serverMsTaken, clampMs } from "@/lib/quiz.functions";
import { verifiedMissionTasks } from "@/lib/missions.functions";

describe("quiz scoring", () => {
  it("gives nothing for a wrong answer", () => {
    expect(scoreAnswer(false, 1000, "expert")).toBe(0);
  });

  it("uses the question's own difficulty", () => {
    expect(scoreAnswer(true, 10_000, "easy")).toBe(10);
    expect(scoreAnswer(true, 10_000, "medium")).toBe(13);
    expect(scoreAnswer(true, 10_000, "hard")).toBe(15);
    expect(scoreAnswer(true, 10_000, "expert")).toBe(20);
  });

  it("adds the speed bonus only under 5 seconds", () => {
    expect(scoreAnswer(true, 4999, "easy")).toBe(15);
    expect(scoreAnswer(true, 5000, "easy")).toBe(10);
  });

  it("clamps times", () => {
    expect(clampMs(0)).toBe(500);
    expect(clampMs(999_999)).toBe(60_000);
  });
});

describe("serverMsTaken", () => {
  const now = Date.parse("2026-10-20T12:00:10Z");
  const start = "2026-10-20T11:00:00Z";

  it("times from the reveal when there is one", () => {
    expect(serverMsTaken(now, "2026-10-20T12:00:07Z", "2026-10-20T12:00:00Z", start)).toBe(3000);
  });

  it("falls back to the previous answer, then the quiz start", () => {
    expect(serverMsTaken(now, null, "2026-10-20T12:00:00Z", start)).toBe(10_000);
    expect(serverMsTaken(now, null, null, start)).toBe(3_610_000);
  });

  it("never goes negative and treats bad dates as slow", () => {
    expect(serverMsTaken(now, "2026-10-20T12:00:20Z", null, start)).toBe(0);
    expect(serverMsTaken(now, "nonsense", null, start)).toBe(60_000);
  });
});

describe("verifiedMissionTasks", () => {
  const base = { discoveries: [], chainClaims: 0, theme: "space" };

  it("proves nothing without play", () => {
    expect(verifiedMissionTasks(base)).toEqual({
      mystery: false,
      surprise: false,
      category: false,
      chain: false,
    });
  });

  it("needs two different facts for the surprise", () => {
    const one = [{ fact_id: "a", category: "ocean" }];
    expect(verifiedMissionTasks({ ...base, discoveries: one }).mystery).toBe(true);
    expect(verifiedMissionTasks({ ...base, discoveries: one }).surprise).toBe(false);
    expect(
      verifiedMissionTasks({ ...base, discoveries: [...one, { fact_id: "a", category: "ocean" }] })
        .surprise,
    ).toBe(false);
    expect(
      verifiedMissionTasks({ ...base, discoveries: [...one, { fact_id: "b", category: "ocean" }] })
        .surprise,
    ).toBe(true);
  });

  it("ticks the theme only for a fact from today's theme", () => {
    expect(
      verifiedMissionTasks({ ...base, discoveries: [{ fact_id: "a", category: "ocean" }] })
        .category,
    ).toBe(false);
    expect(
      verifiedMissionTasks({ ...base, discoveries: [{ fact_id: "a", category: "space" }] })
        .category,
    ).toBe(true);
  });

  it("needs three chain layers read today", () => {
    expect(verifiedMissionTasks({ ...base, chainClaims: 2 }).chain).toBe(false);
    expect(verifiedMissionTasks({ ...base, chainClaims: 3 }).chain).toBe(true);
  });
});
