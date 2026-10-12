# Why? Plus

Why? Plus replaces VIP. It's a subscription sold to parents (and to adult players on the website). It makes the app better without letting money buy leaderboard position, and it works the same on the website, Android and iPhone.

## What everyone gets for free

The whole core app stays free:

- endless facts
- "But… Why?" chains, up to 30 answers an hour
- quizzes, missions, streaks and the Ranks page
- coins earned by playing, and the avatar and theme store

Guests can use it without an account.

## What Why? Plus adds

| | Free | Why? Plus |
|---|---|---|
| "But… Why?" deep dives and search | 30 an hour | 100 an hour |
| Plus-only animated avatars and themes | — | ✓ |
| Plus badge and status bubble on your profile | — | ✓ |
| Coins earned per activity | same | same |

Coins and leaderboard scores are the same for everyone, so the boards stay fair.

### Coming next

These are planned so Plus keeps getting more valuable to parents. They aren't built yet.

1. **Weekly parent email:** what your child explored, their streak, and a fact to talk about at dinner. Needs an email service; this is usually the feature that makes parents decide to pay.
2. **Several child profiles under one family subscription.**
3. **Offline topic packs** for car journeys and flights.
4. **Printable fact cards** for school projects.
5. **Seasonal Curiosity Pass:** a free track everyone climbs by learning, plus a Plus-only track of cosmetics.

## Prices

| Plan | Price | Trial |
|---|---|---|
| Monthly | $3.99 | 7 days free |
| Yearly | $29.99 (about 37% off monthly) | 7 days free |

Prices are set in each store (Google Play, App Store) and in Paddle for the website. The app shows the store's own localised price, so you can change prices without a code change. Apple and Google take 15% under their small-business programmes (30% above $1M a year). Paddle takes about 5% + 50¢.

## What changed from VIP

- **Name:** VIP is now Why? Plus everywhere people see it. Existing VIP subscribers become Plus subscribers automatically.
- **No more 2× coins and no 500-coin welcome bonus.** Paying no longer buys leaderboard position. Coins people already have are untouched.
- **Coin packs are gone.** Coins can't be bought with money.
- **The apps can now sell Plus,** through Google Play and the App Store via RevenueCat, as store rules require. The website keeps Paddle.
- **Every purchase starts with a parent check**, a simple sum for a grown-up, on the website and in the apps.
- **The apps have a "Restore purchases" button and the subscription terms Apple requires.**

## How it works (for developers)

- `plus_entitlements` holds subscriptions bought through the app stores, synced from RevenueCat. Paddle (website) subscriptions stay in `subscriptions`.
- `src/lib/plus.server.ts` decides whether someone has Plus by checking both. Everything asks it: the store, badges, AI limits, Plus avatars and the status bubble.
- RevenueCat's app user ID is the Supabase user ID. The apps call `logIn(userId)` when someone signs in.
- `/api/public/revenuecat/webhook` receives RevenueCat events. On each one, the server re-reads that subscriber from RevenueCat's API and stores the result, so events arriving late or twice don't matter.
- After a purchase or restore in the app, the page calls `refreshMyPlus` so Plus switches on immediately, without waiting for the webhook.
- The RevenueCat entitlement must be called **`plus`**.

## What you need to set up

### 1. Products in the stores

Create two auto-renewing subscriptions in both Google Play Console and App Store Connect, each with a 7-day free trial:

- `why_plus_monthly`, $3.99 a month
- `why_plus_yearly`, $29.99 a year

On iOS, put them in one subscription group called "Why? Plus".

### 2. RevenueCat

1. Add the Android and iOS apps: package and bundle ID `com.ogstreamz196.why`.
2. Import both products.
3. Create an entitlement with the identifier `plus`, and attach both products to it.
4. Create an offering called `default` with two packages: **Monthly** (`$rc_monthly`, `why_plus_monthly`) and **Annual** (`$rc_annual`, `why_plus_yearly`). Make it the current offering.
5. Under **Integrations → Webhooks**, add `https://package-your-dreams.lovable.app/api/public/revenuecat/webhook`. Set the Authorization header to a long random password you make up.
6. Under **API keys**, copy:
   - the Android public SDK key (starts `goog_`)
   - the iOS public SDK key (starts `appl_`)
   - a secret API key (starts `sk_`)

### 3. Secrets in Lovable

Add these under Cloud → Secrets:

| Name | Value |
|---|---|
| `REVENUECAT_SECRET_API_KEY` | the `sk_` key |
| `REVENUECAT_WEBHOOK_AUTH` | the webhook password from step 2.5 |
| `VITE_REVENUECAT_ANDROID_KEY` | the `goog_` key |
| `VITE_REVENUECAT_IOS_KEY` | the `appl_` key |

The two `VITE_` keys are public by design. RevenueCat expects them to be in the app.

### 4. Paddle (website)

Create two prices on a "Why? Plus" product, each with a 7-day trial:

- external ID `plus_monthly`, $3.99 a month
- external ID `plus_yearly`, $29.99 a year

Existing `vip_monthly` subscribers keep Plus.

### 5. Rebuild the apps

The RevenueCat plugin is native code. The Android and iOS apps need a new build and store release before they can sell Plus. The website works as soon as it's published. Until the new app builds are out, the Plus tab stays hidden in the apps.
