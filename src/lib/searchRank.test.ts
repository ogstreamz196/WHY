import { describe, expect, it } from "vitest";
import { rankFacts, searchTerms, stem } from "./searchRank";

const FACTS = [
  { id: 1, question: "is the sky blue", answer: "Sunlight scatters off air; blue scatters most." },
  { id: 2, question: "do cats purr", answer: "Purring comes from fast-twitching throat muscles." },
  { id: 3, question: "do we yawn", answer: "Yawning may cool the brain. Cats yawn too." },
  { id: 4, question: "are flamingos pink", answer: "Their food has pink pigments." },
];

describe("searchTerms", () => {
  it("drops filler words and punctuation", () => {
    expect(searchTerms("Why is the sky BLUE?")).toEqual(["sky", "blue"]);
    expect(searchTerms("why do cats purr")).toEqual(["cat", "purr"]);
    expect(searchTerms("why?")).toEqual([]);
  });

  it("stems simple plurals and -ing", () => {
    expect(stem("flamingos")).toBe("flamingo");
    expect(stem("butterflies")).toBe("butterfl");
    expect(stem("yawning")).toBe("yawn");
    expect(stem("grass")).toBe("grass");
  });
});

describe("rankFacts", () => {
  it("puts question matches above answer-only matches", () => {
    expect(rankFacts(FACTS, "cats").map((f) => f.id)).toEqual([2, 3]);
  });

  it("finds facts without the exact wording", () => {
    expect(rankFacts(FACTS, "why are the flamingo birds pink?")[0].id).toBe(4);
    expect(rankFacts(FACTS, "blue sky")[0].id).toBe(1);
  });

  it("returns nothing when nothing matches", () => {
    expect(rankFacts(FACTS, "volcano")).toEqual([]);
    expect(rankFacts(FACTS, "why")).toEqual([]);
  });
});
