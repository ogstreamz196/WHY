"""E2E: Boss user can open profile Boss Dashboard button, navigate to /boss,
and see key admin controls. Requires TEST_BOSS_EMAIL / TEST_BOSS_PASSWORD env
vars for a seeded boss account (email must be ogstreamz196@gmail.com)."""
import asyncio, os, sys
from pathlib import Path
from playwright.async_api import async_playwright, expect

SHOTS = Path(__file__).parent / "screenshots" / "boss-access"
SHOTS.mkdir(parents=True, exist_ok=True)
BASE = "http://localhost:8080"

async def main():
    email = os.environ.get("TEST_BOSS_EMAIL")
    password = os.environ.get("TEST_BOSS_PASSWORD")
    if not email or not password:
        print("SKIP: TEST_BOSS_EMAIL / TEST_BOSS_PASSWORD not set")
        return 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        ctx = await browser.new_context(viewport={"width": 1280, "height": 1800})
        page = await ctx.new_page()

        # Sign in
        await page.goto(f"{BASE}/auth", wait_until="domcontentloaded")
        await page.get_by_label("Email", exact=False).fill(email)
        await page.get_by_label("Password", exact=False).fill(password)
        await page.get_by_role("button", name="Sign in", exact=False).click()
        await page.wait_for_url(lambda u: "/auth" not in u, timeout=15000)
        await page.screenshot(path=str(SHOTS / "1_signed_in.png"))

        # Open profile & click Boss Dashboard
        await page.goto(f"{BASE}/profile", wait_until="domcontentloaded")
        boss_btn = page.get_by_role("link", name="Boss Dashboard")
        await expect(boss_btn).to_be_visible(timeout=10000)
        await page.screenshot(path=str(SHOTS / "2_profile.png"))
        await boss_btn.click()
        await page.wait_for_url("**/boss", timeout=10000)

        # Verify key controls on /boss
        await expect(page.get_by_role("heading", name="User controls")).to_be_visible(timeout=10000)
        await expect(page.get_by_placeholder("Search by email…")).to_be_visible()
        await expect(page.get_by_text("Privileges", exact=False).first).to_be_visible()
        await page.screenshot(path=str(SHOTS / "3_boss_dashboard.png"))

        print("PASS: boss access verified")
        await browser.close()
        return 0

sys.exit(asyncio.run(main()))
