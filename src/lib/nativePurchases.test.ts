import { afterEach, describe, expect, it, vi } from "vitest";

const rc = vi.hoisted(() => ({ configured: false }));
vi.mock("@revenuecat/purchases-capacitor", () => ({
  Purchases: { isConfigured: async () => ({ isConfigured: rc.configured }) },
}));

function setCapacitor(plugins: boolean) {
  (window as { Capacitor?: unknown }).Capacitor = {
    getPlatform: () => "android",
    isPluginAvailable: () => plugins,
  };
}

async function load() {
  vi.resetModules();
  return import("./nativePurchases");
}

afterEach(() => {
  delete (window as { Capacitor?: unknown }).Capacitor;
  vi.unstubAllEnvs();
});

describe("canUseNativePurchases", () => {
  it("is false on the website", async () => {
    const { canUseNativePurchases } = await load();
    await expect(canUseNativePurchases()).resolves.toBe(false);
  });

  it("is false in an app build without the plugins", async () => {
    setCapacitor(false);
    rc.configured = true;
    const { canUseNativePurchases } = await load();
    await expect(canUseNativePurchases()).resolves.toBe(false);
  });

  it("is false when the plugins are there but RevenueCat has no key", async () => {
    setCapacitor(true);
    rc.configured = false;
    vi.stubEnv("VITE_REVENUECAT_ANDROID_KEY", "");
    const { canUseNativePurchases } = await load();
    await expect(canUseNativePurchases()).resolves.toBe(false);
  });

  it("is true when RevenueCat was configured natively", async () => {
    setCapacitor(true);
    rc.configured = true;
    const { canUseNativePurchases } = await load();
    await expect(canUseNativePurchases()).resolves.toBe(true);
  });

  it("is true when the web side has a key to configure it", async () => {
    setCapacitor(true);
    rc.configured = false;
    vi.stubEnv("VITE_REVENUECAT_ANDROID_KEY", "goog_abc");
    const { canUseNativePurchases } = await load();
    await expect(canUseNativePurchases()).resolves.toBe(true);
  });
});
