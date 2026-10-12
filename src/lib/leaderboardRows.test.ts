import { describe, expect, it } from "vitest";
import { rankRows, type LbRow } from "./leaderboardRows.server";

const row = (id: string, score: number): LbRow => ({
  user_id: id,
  username: id,
  display_name: null,
  avatar_id: null,
  age_band: null,
  favorite_category: null,
  score,
});

const board = (n: number) => Array.from({ length: n }, (_, i) => row(`u${i + 1}`, 1000 - i * 10));

describe("rankRows", () => {
  it("ranks in order and marks the viewer", () => {
    const r = rankRows(board(5), "u3", 50);
    expect(r.entries.map((e) => e.rank)).toEqual([1, 2, 3, 4, 5]);
    expect(r.entries[2].is_me).toBe(true);
    expect(r.my_rank).toBe(3);
    expect(r.total).toBe(5);
    expect(r.nearby).toEqual([]);
  });

  it("returns players around the viewer when they're outside the top list", () => {
    const r = rankRows(board(100), "u60", 50);
    expect(r.entries).toHaveLength(50);
    expect(r.my_rank).toBe(60);
    expect(r.nearby.map((e) => e.rank)).toEqual([58, 59, 60, 61, 62]);
    expect(r.nearby.find((e) => e.is_me)?.user_id).toBe("u60");
  });

  it("never repeats top-list players in the nearby list", () => {
    const r = rankRows(board(100), "u51", 50);
    expect(r.nearby.map((e) => e.rank)).toEqual([51, 52, 53]);
  });

  it("works out the points needed to pass the next player", () => {
    const r = rankRows(board(5), "u4", 50);
    // u3 has 980, u4 has 970: one more than the gap is needed to pass.
    expect(r.points_to_next).toBe(11);
    expect(rankRows(board(5), "u1", 50).points_to_next).toBeNull();
    const tied = [row("a", 50), row("b", 50)];
    expect(rankRows(tied, "b", 50).points_to_next).toBe(1);
  });

  it("handles viewers who aren't on the board", () => {
    const r = rankRows(board(3), "nobody", 50);
    expect(r.my_rank).toBeNull();
    expect(r.points_to_next).toBeNull();
    expect(rankRows(board(3), null, 50).my_rank).toBeNull();
  });
});
