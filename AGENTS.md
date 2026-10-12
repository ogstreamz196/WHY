<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Three versions: website, Android and iOS

Why? ships as the website plus Android and iOS apps (Capacitor, in `mobile/`).
The apps load the live website, so every web change reaches all three without
a store release. Every change must therefore work in all three, and must keep
the apps within Google Play and App Store rules.

Inside the apps (`useIsNativeApp()` / `isNativeApp()` from `src/lib/platform.ts`):

- No Google or Apple sign-in, and no Google account linking. Email sign-in only.
- Digital purchases only through Google Play / App Store billing via
  RevenueCat (`src/lib/nativePurchases.ts`), never Paddle checkout or links to
  web payment. Why? Plus is the only thing sold (see `docs/WHY_PLUS.md`).
- No 18+ content or links to `/adult`.
- Render web-only UI only when `useIsNativeApp() === false`, so it never
  flashes in the apps while the value is still unknown.

For everyone (web and apps):

- Every purchase starts with `ParentGate` (grown-up check). Never sell coins,
  random rewards or anything that changes leaderboard score; Plus perks are
  cosmetic or convenience only. Plus status always comes from
  `getPlusStatus()` (`src/lib/plus.server.ts`).

- Keep account deletion working (`/delete-account`, Settings).
- Keep `/privacy` accurate. If you start collecting, storing or sharing new
  data (a new table, analytics, ads, another AI or third-party service),
  update the privacy policy in the same change.
- Keep the neutral age screen on sign-up; accounts are 13+.
- No ads or tracking SDKs, and no deceptive UI (dodging close buttons, buttons
  that move under the user's tap, forced countdowns). The app is used by
  children.

Changes inside `mobile/` (app icon, splash screen, Capacitor plugins, native
settings, app ID or the site URL in `capacitor.config.ts`) only reach users
through a new Android/iOS build and store release. Say so when making one.
