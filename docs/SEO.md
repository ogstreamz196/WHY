# SEO, logo and search

## What's set up

- **The address Google indexes:** `https://why.ogbot.co.uk`. It's set in `SITE_URL` in `src/lib/site.ts`. If the domain changes, update it there and in `public/robots.txt`.
- **Every page** has its own title, description, canonical link and share card, using `seo()` from `src/lib/site.ts`. Private pages (settings, profile, favourites, sign-in, 18+) are marked `noindex` and blocked in `robots.txt`.
- **A page for every fact.** Each fact has its own page, for example `/fact/why-is-the-sky-blue-why-1a2b3c`. It shows the question as the heading, the answer, the bonus fact and related facts, plus structured data for Google. Old or mistyped links redirect to the right address. Sharing a fact from the app now shares this page, so it opens with a proper preview.
- **Sitemap:** `/sitemap.xml` is built from the fact library (up to 45,000 facts) and refreshed hourly.
- **Site search in Google:** structured data tells Google that `/?q=…` searches Why?. Opening that address opens the search box with the question filled in.
- **Share image:** `public/og-image.png` (1200×630).

## Logo and icons

The logo is a question mark in a little orbit with a star for its dot. It's drawn in `public/logo.svg` and `src/components/WhyLogo.tsx` (keep them the same). These website files are made from it:

- `favicon.ico` (16, 32 and 48 px)
- `favicon-32.png`
- `apple-touch-icon.png` (180 px)
- `icon-192.png` and `icon-512.png`
- `icon-maskable-512.png` (for Android home screens)
- `og-image.png`

The Android and iPhone app icons and launch screens use the same logo (made from `mobile/assets`, see `mobile/README.md`). They reach phones with the next store release.

## Search in the app

- **While you type:** results come from the fact library, matched on the meaningful words, so "why do cats purr" finds facts about cats purring even with different wording. Typos and plurals are handled.
- **No match:** "Make a new fact" asks the AI to write one. Guests can search and make facts too, within the guest hourly limit. Before, search failed for anyone who wasn't signed in.

## Things only you can do

1. **Google Search Console** (https://search.google.com/search-console): add `why.ogbot.co.uk` as a property and verify it. The DNS method is easiest wherever the domain is registered.
2. In Search Console, submit `https://why.ogbot.co.uk/sitemap.xml`.
3. Optionally, do the same in Bing Webmaster Tools; it can import from Search Console.
4. Make sure `why.ogbot.co.uk` really is connected to this project in Lovable (Settings → Domains), and that it's the main domain, so `package-your-dreams.lovable.app` isn't indexed as a duplicate.

New sites usually take a few days to a few weeks to appear in Google.
