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

|                                              | Free       | Why? Plus   |
| -------------------------------------------- | ---------- | ----------- |
| "But… Why?" deep dives and search            | 30 an hour | 100 an hour |
| Plus-only animated avatars and themes        | —          | ✓           |
| Plus badge and status bubble on your profile | —          | ✓           |
| Coins earned per activity                    | same       | same        |

Coins and leaderboard scores are the same for everyone, so the boards stay fair.

### Coming next

These are planned so Plus keeps getting more valuable to parents. They aren't built yet.

1. **Weekly parent email:** what your child explored, their streak, and a fact to talk about at dinner. Needs an email service; this is usually the feature that makes parents decide to pay.
2. **Several child profiles under one family subscription.**
3. **Offline topic packs** for car journeys and flights.
4. **Printable fact cards** for school projects.
5. **Seasonal Curiosity Pass:** a free track everyone climbs by learning, plus a Plus-only track of cosmetics.

## Prices

| Plan    | Price                          | Trial       |
| ------- | ------------------------------ | ----------- |
| Monthly | $3.99                          | 7 days free |
| Yearly  | $29.99 (about 37% off monthly) | 7 days free |

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
- The RevenueCat entitlement is **`why_plus_pro`**. Both products unlock it.
- **Android:** `mobile/android/app/src/main/java/com/ogstreamz196/why/WhyApplication.kt` configures the RevenueCat SDK (`com.revenuecat.purchases:purchases`, the same version the Capacitor plugin uses) when the app starts:
  - Debug builds use the RevenueCat **Test Store** key, so purchases are simulated and free.
  - Release builds use your Google Play key. Without one they hide Plus, and they refuse a `test_` key.
- **iOS** still configures from the web app, using `VITE_REVENUECAT_IOS_KEY`.
- RevenueCat's app user ID is the Supabase user ID. The web app calls `logIn(userId)` once someone signs in (`src/lib/nativePurchases.ts`).
- **Buying:** the app shows the **RevenueCat Paywall** (`presentPaywallIfNeeded` for `why_plus_pro`) after the grown-up check. Prices, trial text and subscription terms come from the store and your paywall design.
- **Managing:** Plus members who subscribed in an app get **Manage subscription**, which opens the **RevenueCat Customer Center**, also behind the grown-up check. There is also a **Restore purchases** button.
- **Server sync:**
  - `/api/public/revenuecat/webhook` re-reads the subscriber from RevenueCat's API on every event, so late or repeated events don't matter.
  - `/api/public/payments/webhook` (Paddle) does the same: on `subscription.created`, `updated`, `canceled` and `transaction.payment_failed` it re-reads the subscription from Paddle and stores its current status. `past_due` is stored as `canceled` (Plus ends at once when a payment fails); a failed payment that leaves the subscription active changes nothing.
  - The app also asks the server to re-sync straight after a purchase, a restore, a Customer Center visit, or a change pushed by the store (one listener for the whole app; website Plus is never re-synced from the store).
- **Which Paddle environment counts:** `VITE_PAYMENTS_CLIENT_TOKEN` starting with `test_` means sandbox (preview), anything else live, on the website and the server alike.
- **Plus only shows where it can be bought:** in the apps, the Plus tab and buttons appear only when the RevenueCat plugins are present and RevenueCat is configured (natively on Android, or with `VITE_REVENUECAT_IOS_KEY` on iOS). Nothing about Plus shows until that's known.
- **Test Store purchases never grant Plus on the server** unless `REVENUECAT_ALLOW_TEST_STORE=true` is set. Only set it while testing.

## What you need to set up

### 1. Products in the stores

Create two auto-renewing subscriptions in both Google Play Console and App Store Connect, each with a 7-day free trial:

- `why_plus_monthly`, $3.99 a month
- `why_plus_yearly`, $29.99 a year

On iOS, put them in one subscription group called "Why? Plus".

### 2. RevenueCat

1. **Apps.** Add the Android and iOS apps (package and bundle ID `com.ogstreamz196.why`) and connect them to Google Play and App Store Connect. The Test Store is already there for testing.
2. **Products.** Import `why_plus_monthly` and `why_plus_yearly` for each store, and add matching products in the Test Store.
3. **Entitlement.** Create one with the identifier **`why_plus_pro`**, and attach every product to it.
4. **Offering.** Create an offering called `default` with two packages, and make it the **current** offering:
   - **Monthly** (`$rc_monthly`): the monthly product
   - **Annual** (`$rc_annual`): the yearly product
5. **Paywall.** Under **Paywalls**, create one for the `default` offering. Show the perks from "What Why? Plus adds" above. Keep it calm and clear: it's for parents, so no countdowns or pressure.
6. **Customer Center.** Under **Customer Center**, switch it on and add a support email.
7. **Webhook.** Under **Integrations → Webhooks**, add `https://package-your-dreams.lovable.app/api/public/revenuecat/webhook`. Set the Authorization header to a long random password you make up.
8. **Keys.** Under **API keys**, copy:
   - the Google Play public SDK key (`goog_…`)
   - the App Store public SDK key (`appl_…`)
   - a secret API key (`sk_…`)

The Test Store key (`test_…`) is already in the Android debug build.

### 3. Secrets

In Lovable (Cloud → Secrets):

| Name                          | Value                                                     |
| ----------------------------- | --------------------------------------------------------- |
| `REVENUECAT_SECRET_API_KEY`   | the `sk_` key                                             |
| `REVENUECAT_WEBHOOK_AUTH`     | the webhook password from step 2.7                        |
| `VITE_REVENUECAT_IOS_KEY`     | the `appl_` key                                           |
| `REVENUECAT_ALLOW_TEST_STORE` | `true` while you test with the Test Store, then delete it |

For Android release builds, give the build your `goog_` key:

- **Android Studio:** add `revenuecatAndroidKey=goog_…` to your personal Gradle settings file, `~/.gradle/gradle.properties` (on Windows, `C:\Users\<you>\.gradle\gradle.properties`). It stays on your computer, not in the project.
- **GitHub builds:** add a repository secret named `REVENUECAT_ANDROID_KEY`.

### 4. Paddle (website)

Create two prices on a "Why? Plus" product, each with a 7-day trial:

- external ID `plus_monthly`, $3.99 a month
- external ID `plus_yearly`, $29.99 a year

Existing `vip_monthly` subscribers keep Plus.

### 5. Test, then release

1. Set `REVENUECAT_ALLOW_TEST_STORE=true`. Build a **debug** app in Android Studio, sign in, open Store → Why? Plus, pass the grown-up check, and buy from the Paywall. The Test Store purchase dialog appears, Plus switches on, and **Manage subscription** opens the Customer Center.
2. Delete `REVENUECAT_ALLOW_TEST_STORE` again.
3. Test real billing with Google Play licence testers or Apple sandbox accounts.
4. Ship **release** builds that include the `goog_` key, and the iOS build with `VITE_REVENUECAT_IOS_KEY` set.

The RevenueCat plugins are native code, so the apps need a new store release before they can sell Plus. Until then, and in any build without a RevenueCat key, the Plus tab stays hidden in the apps.
