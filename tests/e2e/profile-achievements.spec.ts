import { expect, test } from "@playwright/test";

/**
 * These tests exercise the merged Achievements + Explorer badge grid on
 * /profile. The profile route is auth-gated; when no Supabase session is
 * available in the test browser, the router bounces to /auth. In that case
 * we skip the assertions rather than fail — the redirect itself is covered
 * by badges-redirect.spec.ts.
 */

async function gotoProfile(page: import("@playwright/test").Page, hash = "") {
  await page.goto(`/profile${hash}`);
  await page.waitForLoadState("domcontentloaded");
  const path = new URL(page.url()).pathname;
  return path === "/profile";
}

test.describe("Achievements + Explorer badge grid", () => {
  test("shows loading skeletons while server achievements are slow", async ({ page }) => {
    // Delay every server-function response by 1.2s so the skeleton state is
    // observable before real data resolves.
    await page.route("**/_server*/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await page.route("**/_serverFn/**", async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });

    const onProfile = await gotoProfile(page, "#achievements");
    test.skip(!onProfile, "profile is auth-gated in this environment");

    const body = page.locator("#achievements-body");
    await expect(body).toBeVisible();
    // aria-busy region for the skeleton grid
    const busy = body.locator('[aria-busy="true"]').first();
    await expect(busy).toBeVisible();
    await expect(body.getByText(/Loading achievements/i)).toBeAttached();
  });

  test("renders the empty state when there are no achievements", async ({ page }) => {
    // Intercept the achievements server fn and return an empty payload.
    await page.route(/listAchievements|_serverFn.*[Aa]chievements/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ result: [], data: [] }),
      });
    });

    const onProfile = await gotoProfile(page, "#achievements");
    test.skip(!onProfile, "profile is auth-gated in this environment");

    const body = page.locator("#achievements-body");
    await expect(body).toBeVisible();
    await expect(body.getByText(/No achievements yet/i)).toBeVisible();
    await expect(
      body.getByText(/Discover facts, keep a streak going, or take a quiz/i),
    ).toBeVisible();
  });

  test("renders an empty state for explorer badges before local data hydrates", async ({ page }) => {
    // Clear localStorage so no explorer progress exists.
    await page.addInitScript(() => {
      try { window.localStorage.clear(); } catch {}
    });
    const onProfile = await gotoProfile(page, "#achievements");
    test.skip(!onProfile, "profile is auth-gated in this environment");

    const body = page.locator("#achievements-body");
    await expect(body).toBeVisible();
    // Either the hydration skeleton or the empty state must appear.
    const empty = body.getByText(/Explorer badges appear here/i);
    const skeleton = body.locator('[aria-busy="true"]');
    await expect(empty.or(skeleton).first()).toBeVisible();
  });
});

test.describe("/badges round-trip preserves scroll + achievements state", () => {
  test("navigating to /badges and back keeps the user on Achievements", async ({ page }) => {
    const onProfile = await gotoProfile(page, "#achievements");
    test.skip(!onProfile, "profile is auth-gated in this environment");

    // Scroll near the achievements anchor to establish a known position.
    await page.locator("#achievements").scrollIntoViewIfNeeded();
    const beforeY = await page.evaluate(() => Math.round(window.scrollY));

    // Bounce through the legacy /badges redirect.
    await page.goto("/badges");
    await page.waitForLoadState("domcontentloaded");

    const url = new URL(page.url());
    expect(url.pathname).toBe("/profile");
    expect(url.hash).toBe("#achievements");

    // The Achievements section must still be present and reachable.
    const anchor = page.locator("#achievements");
    await expect(anchor).toHaveCount(1);
    const body = page.locator("#achievements-body");
    await expect(body).toBeVisible();

    // Scroll position should land at (or very near) the achievements anchor.
    const afterY = await page.evaluate(() => Math.round(window.scrollY));
    // Allow a generous delta — layout differences between visits are fine
    // as long as we didn't snap back to the very top of the page.
    expect(Math.abs(afterY - beforeY)).toBeLessThan(400);
    expect(afterY).toBeGreaterThan(0);
  });
});
