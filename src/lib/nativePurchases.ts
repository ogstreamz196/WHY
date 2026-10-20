// Why? Plus inside the Android/iOS apps, through RevenueCat (Google Play /
// App Store billing, as the stores require). The native SDK is added in
// mobile/ by the Capacitor plugins; on Android it's configured with the right
// key as the app starts (mobile/android/.../WhyApplication.kt). Here we log the
// signed-in user in, check the "why_plus_pro" entitlement, and show the
// RevenueCat Paywall and Customer Center. On the website none of this runs and
// Paddle checkout is used instead. See docs/WHY_PLUS.md.

/** RevenueCat entitlement that unlocks Why? Plus (must match the dashboard). */
export const PLUS_ENTITLEMENT_ID = "why_plus_pro";

type CapacitorGlobal = {
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor;
}

/** Key for builds that don't configure RevenueCat natively (today: iOS). */
function webSideKey(): string | undefined {
  const platform = capacitor()?.getPlatform?.();
  if (platform === "ios") return import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  if (platform === "android")
    return import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  return undefined;
}

/** True in an app build that includes the RevenueCat plugins. */
export function isNativePurchasesAvailable(): boolean {
  const cap = capacitor();
  return !!cap?.isPluginAvailable?.("Purchases") && !!cap?.isPluginAvailable?.("RevenueCatUI");
}

let usable: Promise<boolean> | null = null;

/**
 * True when this app build can really sell Plus: the plugins are there AND
 * RevenueCat is configured natively (Android) or a key is set for the web
 * side to configure it (iOS). Builds without a key hide Plus. Cached.
 */
export function canUseNativePurchases(): Promise<boolean> {
  if (!isNativePurchasesAvailable()) return Promise.resolve(false);
  usable ??= (async () => {
    if (webSideKey()) return true;
    try {
      const { Purchases } = await import("@revenuecat/purchases-capacitor");
      return (await Purchases.isConfigured()).isConfigured;
    } catch (e) {
      console.warn("[plus] couldn't check the store setup", e);
      return false;
    }
  })();
  return usable;
}

let loggedInAs: string | null = null;

/**
 * Make sure the SDK is configured and identifies this account. RevenueCat's
 * app user ID is the Supabase user ID, which is how the server finds a
 * purchase (webhook and refreshMyPlus).
 */
async function purchasesFor(userId: string) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    const key = webSideKey();
    if (!key) throw new Error("In-app purchases aren't set up in this build.");
    await Purchases.configure({ apiKey: key, appUserID: userId });
    loggedInAs = userId;
  } else if (loggedInAs !== userId) {
    await Purchases.logIn({ appUserID: userId });
    loggedInAs = userId;
  }
  return Purchases;
}

/** Whether the store says this account has Plus right now (customer info). */
export async function hasNativePlus(userId: string): Promise<boolean> {
  const p = await purchasesFor(userId);
  const { customerInfo } = await p.getCustomerInfo();
  return !!customerInfo.entitlements.active[PLUS_ENTITLEMENT_ID];
}

export type PaywallOutcome = "purchased" | "restored" | "cancelled" | "already_plus" | "error";

/**
 * Show the RevenueCat Paywall (designed in the dashboard, current offering),
 * unless this account already has why_plus_pro.
 */
export async function presentPlusPaywall(userId: string): Promise<PaywallOutcome> {
  await purchasesFor(userId);
  const { RevenueCatUI, PAYWALL_RESULT } = await import("@revenuecat/purchases-capacitor-ui");
  const { result } = await RevenueCatUI.presentPaywallIfNeeded({
    requiredEntitlementIdentifier: PLUS_ENTITLEMENT_ID,
    displayCloseButton: true,
  });
  switch (result) {
    case PAYWALL_RESULT.PURCHASED:
      return "purchased";
    case PAYWALL_RESULT.RESTORED:
      return "restored";
    case PAYWALL_RESULT.NOT_PRESENTED:
      return "already_plus";
    case PAYWALL_RESULT.ERROR:
      return "error";
    default:
      return "cancelled";
  }
}

/**
 * RevenueCat Customer Center: manage or cancel the subscription, restore
 * purchases, request help. Only for subscriptions bought in the app stores.
 */
export async function presentPlusCustomerCenter(userId: string): Promise<void> {
  await purchasesFor(userId);
  const { RevenueCatUI } = await import("@revenuecat/purchases-capacitor-ui");
  await RevenueCatUI.presentCustomerCenter();
}

/** "Restore purchases", required by Apple. */
export async function restorePlus(userId: string): Promise<void> {
  const p = await purchasesFor(userId);
  await p.restorePurchases();
}

/**
 * Call `onChange` whenever the store reports new customer info for this
 * account (renewal, expiry, refund, a purchase on another device). Returns a
 * function that stops listening.
 */
export async function watchNativeCustomerInfo(
  userId: string,
  onChange: (hasPlus: boolean) => void,
): Promise<() => void> {
  const p = await purchasesFor(userId);
  const id = await p.addCustomerInfoUpdateListener((info) => {
    onChange(!!info.entitlements.active[PLUS_ENTITLEMENT_ID]);
  });
  return () => {
    void p.removeCustomerInfoUpdateListener({ listenerToRemove: id });
  };
}
