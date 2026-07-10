import { expect, test } from "@playwright/test";

/**
 * Equipping an avatar in the shop should:
 *   1. Show optimistically on the profile page (no manual refresh).
 *   2. Appear inside the player-profile modal opened from the leaderboard.
 *
 * The store's server sync path only fires when signed in, and profile /
 * leaderboard-modal state requires a Supabase session. When the environment
 * has no auth (LOVABLE_BROWSER_AUTH_STATUS !== "injected"), we skip rather
 * than fail — the redirect gate is covered by other suites.
 */

async function ensureStore(page: import("@playwright/test").Page) {
  await page.goto("/store");
  await page.waitForLoadState("domcontentloaded");
  return new URL(page.url()).pathname === "/store";
}

test.describe("Avatar equip → profile + leaderboard modal", () => {
  test("equipped avatar appears on profile and in the leaderboard modal", async ({ page }) => {
    const onStore = await ensureStore(page);
    test.skip(!onStore, "store requires a real preview environment");

    // Switch to the Avatars tab.
    const avatarsTab = page.getByRole("button", { name: /Avatars/i });
    await avatarsTab.click();

    // Pick an owned-but-not-equipped avatar (an "Equip" button that is enabled).
    const equipBtn = page.getByRole("button", { name: /^Equip$/ }).first();
    test.skip(
      !(await equipBtn.isVisible().catch(() => false)),
      "no unowned/idle avatar available to equip in this account",
    );

    // Capture the emoji from the tile so we can assert it on other pages.
    const tile = equipBtn.locator("xpath=ancestor::article[1]");
    const emoji = (await tile.locator("span[aria-hidden]").first().innerText()).trim();
    expect(emoji.length).toBeGreaterThan(0);

    await equipBtn.click();

    // The tile should flip to the "Equipped" state immediately (optimistic UI).
    await expect(tile.getByText(/Equipped/i)).toBeVisible({ timeout: 2_000 });

    // --- Profile: avatar reflects instantly, no manual reload. ---
    await page.goto("/profile");
    await page.waitForLoadState("domcontentloaded");
    if (new URL(page.url()).pathname === "/profile") {
      // Header avatar area renders the equipped emoji.
      await expect(page.getByText(emoji, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    }

    // --- Leaderboard modal: opening my own row shows the same avatar. ---
    await page.goto("/leaderboard");
    await page.waitForLoadState("domcontentloaded");
    const you = page.getByRole("button", { name: /View .*profile, rank/i }).first();
    if (await you.isVisible().catch(() => false)) {
      await you.click();
      const modal = page.getByRole("dialog");
      await expect(modal).toBeVisible();
      await expect(modal.getByText(emoji, { exact: false }).first()).toBeVisible({ timeout: 5_000 });
    }
  });
});
