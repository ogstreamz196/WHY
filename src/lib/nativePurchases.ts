// Why? Plus purchases inside the Android/iOS apps, through RevenueCat
// (Google Play / App Store billing, as the stores require). The plugin is
// native code added in mobile/, so this only works in app builds that include
// it; everywhere else isNativePurchasesAvailable() is false and the website's
// Paddle checkout is used instead. See docs/WHY_PLUS.md.
import type { PurchasesPackage } from "@revenuecat/purchases-capacitor";

type CapacitorGlobal = {
  getPlatform?: () => string;
  isPluginAvailable?: (name: string) => boolean;
};

function capacitor(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as { Capacitor?: CapacitorGlobal }).Capacitor;
}

function apiKey(): string | undefined {
  const platform = capacitor()?.getPlatform?.();
  if (platform === "ios") return import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
  if (platform === "android")
    return import.meta.env.VITE_REVENUECAT_ANDROID_KEY as string | undefined;
  return undefined;
}

/** True in an app build that has the RevenueCat plugin and a key configured. */
export function isNativePurchasesAvailable(): boolean {
  const cap = capacitor();
  return !!cap?.isPluginAvailable?.("Purchases") && !!apiKey();
}

let configuredFor: string | null = null;

async function purchases(userId: string) {
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  const key = apiKey();
  if (!key) throw new Error("In-app purchases aren't set up in this build.");
  if (configuredFor === null) {
    // RevenueCat's app user ID is the Supabase user ID (the server syncs by it).
    await Purchases.configure({ apiKey: key, appUserID: userId });
    configuredFor = userId;
  } else if (configuredFor !== userId) {
    await Purchases.logIn({ appUserID: userId });
    configuredFor = userId;
  }
  return Purchases;
}

export type PlusPlan = {
  id: "monthly" | "annual";
  priceString: string;
  /** e.g. "7-day free trial", when the store offers one to this person. */
  trialLabel: string | null;
  pkg: PurchasesPackage;
};

function trialLabelFor(pkg: PurchasesPackage): string | null {
  const product = pkg.product as PurchasesPackage["product"] & {
    defaultOption?: { freePhase?: { billingPeriod?: { iso8601?: string } } | null } | null;
  };
  const intro = product.introPrice;
  if (intro && intro.price === 0) {
    const unit = intro.periodUnit.toLowerCase();
    return `${intro.periodNumberOfUnits}-${unit} free trial`;
  }
  const iso = product.defaultOption?.freePhase?.billingPeriod?.iso8601;
  const m = iso?.match(/^P(\d+)([DWM])$/);
  if (m) {
    const unit = m[2] === "D" ? "day" : m[2] === "W" ? "week" : "month";
    return `${m[1]}-${unit} free trial`;
  }
  return null;
}

/** Monthly and yearly plans from the current RevenueCat offering, with store prices. */
export async function loadPlusPlans(userId: string): Promise<PlusPlan[]> {
  const p = await purchases(userId);
  const offerings = await p.getOfferings();
  const current = offerings.current;
  const plans: PlusPlan[] = [];
  if (current?.monthly) {
    plans.push({
      id: "monthly",
      priceString: current.monthly.product.priceString,
      trialLabel: trialLabelFor(current.monthly),
      pkg: current.monthly,
    });
  }
  if (current?.annual) {
    plans.push({
      id: "annual",
      priceString: current.annual.product.priceString,
      trialLabel: trialLabelFor(current.annual),
      pkg: current.annual,
    });
  }
  return plans;
}

/** Buy a plan. Resolves false if the person cancelled the store sheet. */
export async function buyPlusPlan(userId: string, plan: PlusPlan): Promise<boolean> {
  const p = await purchases(userId);
  try {
    await p.purchasePackage({ aPackage: plan.pkg });
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean | null }).userCancelled) return false;
    throw e;
  }
}

/** "Restore purchases", required by Apple. */
export async function restorePlus(userId: string): Promise<void> {
  const p = await purchases(userId);
  await p.restorePurchases();
}
