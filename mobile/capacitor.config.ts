import type { CapacitorConfig } from "@capacitor/cli";

// The apps load the live web app. Change WHY_APP_URL (or this default) if the
// app moves to a custom domain, then run `npx cap sync`.
const serverUrl = process.env.WHY_APP_URL ?? "https://why.ogbot.co.uk";

const config: CapacitorConfig = {
  appId: "com.ogstreamz196.why",
  appName: "Why?",
  webDir: "www",
  // The web app looks for this marker to hide web-only features
  // (Google/Apple sign-in, web payments, 18+ mode). See src/lib/platform.ts.
  appendUserAgent: "WhyNativeApp",
  backgroundColor: "#0b0518",
  server: {
    url: serverUrl,
    cleartext: false,
    // Shown when the device is offline or the site can't be reached.
    errorPath: "offline.html",
    allowNavigation: [
      "why.ogbot.co.uk",
      "*.ogbot.co.uk",
      "package-your-dreams.lovable.app",
      "*.lovable.app",
      "*.lovableproject.com",
    ],
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: "never",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#0b0518",
      showSpinner: false,
    },
    StatusBar: {
      style: "DARK",
      backgroundColor: "#0b0518",
      overlaysWebView: false,
    },
  },
};

export default config;
