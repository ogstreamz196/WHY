import { test, expect } from "@playwright/test";

// Regex: two "why" tokens in a row (case-insensitive), separated by whitespace.
const DUPLICATE_WHY = /\bwhy\s+why\b/i;

test.describe("Home headline & Curious? pill", () => {
  test("neither the headline nor the pill ever duplicates the word 'why'", async ({ page }) => {
    const seenHeadlines: string[] = [];

    for (let i = 0; i < 8; i++) {
      await page.goto("/", { waitUntil: "networkidle" });

      const pill = page.getByText("Curious?", { exact: true });
      await expect(pill).toBeVisible();
      const pillText = (await pill.innerText()).toLowerCase();
      // Pill must never contain the word "why" at all.
      expect(pillText).not.toMatch(/\bwhy\b/i);

      const headline = page.locator("h1").first();
      await expect(headline).toBeVisible();
      const headlineText = (await headline.innerText()).trim();
      seenHeadlines.push(headlineText);

      // Headline must start with a capitalised "Why" (or another accepted opener).
      expect(headlineText).toMatch(/^(Why|How|How come|What (makes|causes))\b/);
      // No consecutive "why why" tokens anywhere in the headline.
      expect(DUPLICATE_WHY.test(headlineText)).toBe(false);
      // Ends in exactly one '?'.
      expect(headlineText).toMatch(/[^?!.]\?$/);
      // Only one leading "why" token.
      const firstTwo = headlineText.toLowerCase().split(/\s+/).slice(0, 2);
      const whyCount = firstTwo.filter((t) => t.replace(/[^a-z]/g, "") === "why").length;
      expect(whyCount).toBeLessThanOrEqual(1);
    }

    // Sanity: we actually rendered content.
    expect(seenHeadlines.length).toBe(8);
    for (const h of seenHeadlines) expect(h.length).toBeGreaterThan(3);
  });
});
