import { describe, expect, it } from "vitest";
import { codeFromFactSlug, factPath, factSlug, seo, slugify } from "./site";

describe("fact links", () => {
  it("makes readable slugs that carry the fact code", () => {
    expect(factSlug("Why is the sky blue?", "WHY-1A2B3C")).toBe("why-is-the-sky-blue-why-1a2b3c");
    expect(factSlug("do cats purr", "WHY-00FF00")).toBe("why-do-cats-purr-why-00ff00");
    expect(factPath("Do you know why bees buzz?", "WHY-ABCDEF")).toBe(
      "/fact/why-bees-buzz-why-abcdef",
    );
  });

  it("reads the code back from any slug ending", () => {
    expect(codeFromFactSlug("why-is-the-sky-blue-why-1a2b3c")).toBe("WHY-1A2B3C");
    expect(codeFromFactSlug("why-1a2b3c")).toBe("WHY-1A2B3C");
    expect(codeFromFactSlug("anything-else-WHY-ABCDEF")).toBe("WHY-ABCDEF");
    expect(codeFromFactSlug("why-is-the-sky-blue")).toBeNull();
    expect(codeFromFactSlug("why-zzzzzz")).toBeNull();
  });

  it("keeps slugs short and clean", () => {
    const long = slugify("A".repeat(10) + " " + "word ".repeat(30));
    expect(long.length).toBeLessThanOrEqual(70);
    expect(long.endsWith("-")).toBe(false);
    expect(slugify("Café’s “best” crêpes!")).toBe("cafes-best-crepes");
  });
});

describe("seo", () => {
  it("adds a canonical link and social cards", () => {
    const s = seo({ title: "Ranks | Why?", path: "/leaderboard" });
    expect(s.links).toEqual([{ rel: "canonical", href: "https://why.ogbot.co.uk/leaderboard" }]);
    expect(s.meta).toContainEqual({
      property: "og:url",
      content: "https://why.ogbot.co.uk/leaderboard",
    });
  });

  it("marks private pages noindex without a canonical", () => {
    const s = seo({ title: "Settings", noindex: true });
    expect(s.links).toEqual([]);
    expect(s.meta).toContainEqual({ name: "robots", content: "noindex, nofollow" });
  });

  it("trims long descriptions", () => {
    const s = seo({ title: "x", description: "y".repeat(300) });
    const d = s.meta.find((m) => m.name === "description")!.content;
    expect(d.length).toBeLessThanOrEqual(160);
  });
});
