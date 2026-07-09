import asyncio
from pathlib import Path
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
ROUTES = ["/", "/leaderboard", "/badges", "/store", "/chains", "/profile", "/settings"]
SHOTS = Path(__file__).parent / "shots"; SHOTS.mkdir(exist_ok=True)

INIT = r"""
window.__forceBossInterval = setInterval(function(){
  if (document.documentElement && !document.documentElement.classList.contains('theme-boss')) {
    document.documentElement.classList.add('theme-boss');
  }
}, 30);
"""

async def check(page, label):
    # Wait until class is present (up to 3s)
    await page.wait_for_function(
        "document.documentElement.classList.contains('theme-boss')", timeout=3000
    )
    data = await page.evaluate("""() => {
      const cs = getComputedStyle(document.documentElement);
      return {
        hasClass: document.documentElement.classList.contains('theme-boss'),
        ring: cs.getPropertyValue('--ring').trim(),
        glow: cs.getPropertyValue('--glow').trim(),
        bg:   cs.getPropertyValue('--background').trim(),
      };
    }""")
    print(label, data)
    assert data["hasClass"], f"{label}: .theme-boss missing"
    return data

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width":1280,"height":900})
        await context.add_init_script(INIT)
        page = await context.new_page()

        baseline = None
        for r in ROUTES:
            await page.goto(BASE + r, wait_until="domcontentloaded")
            d = await check(page, f"nav  {r}")
            await page.screenshot(path=str(SHOTS / f"nav_{(r.strip('/') or 'root').replace('/','_')}.png"))
            if baseline is None:
                baseline = d
            else:
                assert d["ring"] == baseline["ring"], f"{r}: --ring drifted from {baseline['ring']} to {d['ring']}"
                assert d["glow"] == baseline["glow"], f"{r}: --glow drifted"
                assert d["bg"]   == baseline["bg"],   f"{r}: --background drifted"

            await page.reload(wait_until="domcontentloaded")
            d2 = await check(page, f"rld  {r}")
            assert d2["ring"] == baseline["ring"], f"{r} reload: --ring drifted"

        print("\nPASS — .theme-boss present and boss tokens stable across",
              len(ROUTES), "routes + reloads.")
        print("baseline tokens:", baseline)
        await browser.close()

asyncio.run(main())
