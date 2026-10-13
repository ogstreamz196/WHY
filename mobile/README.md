# Why? for Android and iOS

This folder holds the Android and iOS apps. They are built with Capacitor and open the live Why? website (`https://package-your-dreams.lovable.app`) inside a native app, with its own icon, launch screen and offline page. Changes you make to the website show up in the apps straight away, without a new store release.

Inside the apps, the website hides the things the stores don't allow there:

- Google and Apple sign-in (people sign in with email instead)
- Paddle checkout for Why? Plus (the apps sell Plus through Google Play and the App Store instead, see `docs/WHY_PLUS.md`)
- the 18+ mode

The website itself is unchanged. The app is spotted by a `WhyNativeApp` marker it adds to its browser identity; the code is in `src/lib/platform.ts`.

If the site moves to a custom domain, change `serverUrl` in `capacitor.config.ts` and the address in `www/offline.html`, then build again.


## What needs a new store release

Changes made in Lovable or on GitHub to the website reach all three versions as soon as the site is published. Nothing needs uploading to the stores.

A new Android/iOS build and store release is only needed for changes inside this `mobile` folder:

- the app icon or launch screen
- adding a Capacitor plugin
- native settings
- the app ID
- the website address the apps open


## Building and signing in Android Studio

1. In this `mobile` folder, run `npm ci`, then `npx cap sync android`.
2. Open the `mobile/android` folder in Android Studio (or run `npx cap open android`).
3. Before each Play upload, raise the version code (and, if you like, the version name) in `android/app/build.gradle`. Look for the comment about versionCode.
4. Use **Build → Generate Signed App Bundle or APK**, choose **Android App Bundle**, and pick your own key.

### RevenueCat in Android builds

- **Debug builds** use the RevenueCat Test Store key, so in-app purchases are simulated and free.
- **Release builds** need your Google Play key (`goog_…`). Add `revenuecatAndroidKey=goog_…` to `~/.gradle/gradle.properties` on your computer, or set it as the `REVENUECAT_ANDROID_KEY` environment variable. Without it, the release app simply hides Why? Plus.

See `docs/WHY_PLUS.md` for the full setup.

## Getting the Android files from GitHub instead

You don't need Android Studio. GitHub builds the app for you.

1. On GitHub, open the repository and go to **Actions**, then **Mobile apps**.
2. Click **Run workflow**. You can type the version people will see, such as `1.0.0`.
3. When the run finishes, scroll to **Artifacts** at the bottom of the run page. You'll find two downloads:
   - **why-android-test-apk**: install this on an Android phone to try the app. You may need to allow "install unknown apps".
   - **why-android-play-bundle**: the `.aab` file you upload to Google Play.

Each run gets a higher version code automatically, which Google Play needs for every new upload.

### Optional: let GitHub sign the Play bundle

You don't need this if you sign in Android Studio. Google Play only accepts bundles signed with your private upload key. Add these four repository secrets on GitHub under **Settings → Secrets and variables → Actions**:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Without them, the build still works but the Play bundle is unsigned and Play will reject it. Keep the key file and password safe: every future update must be signed with the same key. If it's ever lost, Google can reset it through Play Console support.


## Publishing on Google Play

You'll need a Google Play developer account. Personal accounts created after November 2023 must first run a **closed test with at least 12 testers for 14 days** before Google allows a production release, so plan for that.

In Play Console, create the app, upload the `.aab` to a testing track, and fill in **App content**. Here is what this app does, so you can answer accurately:

- **Privacy policy:** `https://package-your-dreams.lovable.app/privacy`. Fill in `CONTACT_EMAIL` in `src/lib/legal.ts` first.
- **Ads:** the app contains no ads.
- **App access:** sign-in is optional, but give reviewers a working email and password so they can see the account features.
- **Account deletion:** in the app under Settings → Delete account. Web link: `https://package-your-dreams.lovable.app/delete-account`.
- **Data safety:**
  - Collected: email address, name (display name and username), user IDs, app activity (facts viewed, quiz answers, favourites, scores), and anything people type in search or "But… Why?" (sent to the AI provider to answer).
  - Not sold, not used for advertising, encrypted in transit, and people can delete their data.
  - Guests give no personal information.
- **Target audience and content:** accounts are 13+, with a neutral age check at sign-up, and younger children can use guest mode. Content is written for 8 to 12 year olds, so Google will treat the app as appealing to children and the **Families policy** applies. Choose the age groups carefully; this is your decision.
- **Content rating:** complete the questionnaire. The app has no violence, gambling or chat. It does have user names on public leaderboards and AI-generated text.
- **Store listing:** ready-made images are in `assets/store/`.
  - App icon: `play-store-icon-512.png` (512×512, square; Google rounds the corners).
  - Feature graphic: `feature-graphic-1024x500.png`.
  - You still need at least two phone screenshots. Take them from the app itself, and don't show 18+ mode, which isn't in the app.
- **Advertising ID:** answer "No, my app doesn't use an advertising ID". The app removes the `AD_ID` permission, and the GitHub build fails if a library ever adds it back.


## Building and publishing for iOS

Apple only lets apps be signed and uploaded from a Mac with Xcode, or from a build service linked to your Apple Developer account ($99 a year). GitHub checks that the iOS project compiles on every change, but it can't upload it for you without your Apple certificates.

On a Mac with Xcode installed:

1. Clone the repository. In this `mobile` folder, run `npm ci`, then `npx cap sync ios`, then `npx cap open ios`.
2. In Xcode, select the **App** target. Under **Signing & Capabilities**, choose your team. The bundle ID is `com.ogstreamz196.why`; change it here before your first upload if you want a different one.
3. Choose **Product → Archive**, then **Distribute App → App Store Connect**.

In App Store Connect, fill in:

- the privacy policy URL
- the App Privacy answers (the same data as above)
- the age rating
- a demo account for the reviewer

Apple sometimes rejects apps that are mostly a website in a wrapper (guideline 4.2). The offline page, launch screen and app-only behaviour help, but be ready to explain what the app offers if they ask.


## Google Play Families policy (children and young teens)

Children use Why? (accounts are 13+, younger explorers play as guests, and the facts are written for 8 to 12 year olds), so Google applies its Families policy. Here's how the app meets it:

- **No ads, and no advertising ID.** The `AD_ID` permission is removed in `AndroidManifest.xml`, and CI checks the final app's permissions on every build. Only internet, network state and Play Billing are allowed.
- **No data from children beyond what the app needs.** Guests give no personal information. Accounts need only a username, a password and a birth month and year (asked neutrally).
- **No Google or Apple sign-in in the app,** and no links out to web payments.
- **A grown-up check before every purchase.** Why? Plus is sold through Google Play Billing only, and coins can't be bought.
- **No 18+ content.** 18+ mode is website only, and the server refuses it from the app.
- **The icon and store images suit children:** no "free", "#1" or ranking claims, no fake badges, nothing scary.
- **Account deletion** is in the app and on the web.

In Play Console, under **Target audience and content**, choose the age groups honestly. If you include any under-13 group, the Families policy applies in full, and the answers above are what you'll need.

## Changing the app icon or launch screen

The source images are in `assets/`, made from the logo in `../public/logo.svg`:

- `icon-only.png`: the full icon
- `icon-foreground.png` and `icon-background.png`: Android's adaptive icon layers
- `splash.png` and `splash-dark.png`: the launch screen

To regenerate every size, run `npm run assets` in this folder. The new icon only reaches people's phones with a new store release.

## Developer notes

- `capacitor.config.ts` holds the app ID (`com.ogstreamz196.why`), app name, server URL, splash screen and status bar settings.
- To regenerate icons and splash screens after changing anything in `assets/`, run `npm run assets`.
- `android/app/build.gradle` reads `WHY_VERSION_CODE`, `WHY_VERSION_NAME` and the `WHY_KEYSTORE_*` variables from the environment. CI sets them.
- Android targets API level 36 and iOS 15+. The only Android permission is internet access.
