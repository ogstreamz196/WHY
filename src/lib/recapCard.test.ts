import { describe, it, expect } from "vitest";
import { recapCardLines } from "./recapCard";

describe("recapCardLines", () => {
  it("lists facts, streak and the top topic", () => {
    expect(
      recapCardLines({
        discoveries: 12,
        current_streak: 4,
        categories: [{ key: "space", count: 5, pct: 42 }],
      }),
    ).toEqual(["✨ 12 facts discovered", "🔥 4-day streak", "🚀 Favourite topic: Space"]);
  });
  it("leaves out the topic when there isn't one", () => {
    expect(recapCardLines({ discoveries: 1, current_streak: 0, categories: [] })).toEqual([
      "✨ 1 fact discovered",
      "🔥 0-day streak",
    ]);
  });
});
