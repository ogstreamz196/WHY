import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ParentGate } from "@/components/ParentGate";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { usePlus, usePlusForSale } from "@/hooks/usePlus";
import { refreshMyPlus } from "@/lib/plus.functions";
import { presentPlusCustomerCenter, presentPlusPaywall, restorePlus } from "@/lib/nativePurchases";
import { useIsNativeApp } from "@/lib/platform";
import { PLUS_PERKS, PLUS_TRIAL_LABEL, WEB_PLUS_PLANS } from "@/lib/plusPlans";

type GatedAction = "paywall" | "web-checkout" | "customer-center";

/**
 * Why? Plus sign-up and status.
 * - Website: our plan picker and Paddle checkout.
 * - Android/iOS apps: the RevenueCat Paywall (prices, trial and subscription
 *   terms come from the stores and the dashboard), Restore purchases, and the
 *   RevenueCat Customer Center for managing a store subscription.
 * Every purchase or subscription change starts with the grown-up check.
 * See docs/WHY_PLUS.md.
 */
export function PlusPanel({
  userId,
  userEmail,
  onActivated,
}: {
  userId: string | null;
  userEmail?: string;
  onActivated?: () => void;
}) {
  const isNative = useIsNativeApp();
  const forSale = usePlusForSale();
  // Store billing works in this app build (plugins and a RevenueCat key).
  const nativeStore = isNative === true && forSale === true;
  const { plus, isPlus, refetch } = usePlus(userId);
  const refresh = useServerFn(refreshMyPlus);
  const { openCheckout } = usePaddleCheckout();
  const [webPlan, setWebPlan] = useState<(typeof WEB_PLUS_PLANS)[number]["id"]>("annual");
  const [gated, setGated] = useState<GatedAction | null>(null);
  const [busy, setBusy] = useState(false);

  async function syncAfterStoreChange(successText: string, emptyText: string) {
    const status = await refresh();
    await refetch();
    if (status.active) {
      onActivated?.();
      toast.success(successText);
    } else {
      toast(emptyText);
    }
  }

  async function run(action: GatedAction) {
    if (!userId) return;
    setBusy(true);
    try {
      if (action === "paywall") {
        const outcome = await presentPlusPaywall(userId);
        if (outcome === "purchased") {
          await syncAfterStoreChange(
            "✨ Welcome to Why? Plus!",
            "Thanks! Your Plus will switch on in a moment.",
          );
        } else if (outcome === "restored" || outcome === "already_plus") {
          await syncAfterStoreChange(
            "✨ Why? Plus restored!",
            "No Why? Plus purchase found for this account.",
          );
        } else if (outcome === "error") {
          toast.error("Something went wrong with the store. Please try again.");
        }
      } else if (action === "customer-center") {
        await presentPlusCustomerCenter(userId);
        // They may have cancelled, changed plan or restored.
        await refresh();
        await refetch();
      } else {
        const plan = WEB_PLUS_PLANS.find((p) => p.id === webPlan) ?? WEB_PLUS_PLANS[0];
        await openCheckout({
          priceId: plan.paddlePriceId,
          customerEmail: userEmail,
          customData: { userId },
          successUrl: `${window.location.origin}/store?checkout=success`,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error(
        action === "web-checkout"
          ? "Checkout didn't open — please try again."
          : "The store isn't available right now — please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!userId) return;
    setBusy(true);
    try {
      await restorePlus(userId);
      await syncAfterStoreChange(
        "✨ Why? Plus restored!",
        "No Why? Plus purchase found for this account.",
      );
    } catch (e) {
      console.error(e);
      toast.error("Couldn't restore purchases — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const storeSubscription = plus?.source === "app_store" || plus?.source === "play_store";

  return (
    <div className="glass-strong relative overflow-hidden rounded-3xl p-5">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        style={{
          background:
            "radial-gradient(circle at 20% 10%, rgba(255,200,80,0.35), transparent 60%), radial-gradient(circle at 90% 90%, rgba(180,80,255,0.25), transparent 60%)",
        }}
      />
      <div className="flex items-center gap-2">
        <Crown className="h-6 w-6 text-yellow-300" aria-hidden />
        <h2 className="font-display text-2xl font-black text-white">Why? Plus</h2>
      </div>
      <p className="mt-2 text-sm text-white/85">
        More deep dives and exclusive looks for curious minds. Coins and ranks stay the same for
        everyone, so the leaderboards stay fair.
      </p>
      <ul className="mt-3 space-y-1.5 text-sm text-white/85">
        {PLUS_PERKS.map((perk) => (
          <li key={perk} className="flex items-start gap-2">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" aria-hidden /> {perk}
          </li>
        ))}
      </ul>

      {isPlus ? (
        <div className="mt-4 rounded-2xl bg-emerald-500/20 px-4 py-3 text-center text-sm text-emerald-100">
          <p className="font-black">✨ You have Why? Plus</p>
          {plus?.expires_at && (
            <p className="mt-0.5 text-xs">
              {plus.will_renew ? "Renews" : "Ends"} {new Date(plus.expires_at).toLocaleDateString()}
            </p>
          )}
          {nativeStore && storeSubscription ? (
            <button
              type="button"
              onClick={() => setGated("customer-center")}
              disabled={busy}
              className="mt-2 rounded-full bg-white/15 px-4 py-1.5 text-xs font-black text-white"
            >
              Manage subscription
            </button>
          ) : storeSubscription ? (
            <p className="mt-1 text-xs">
              Manage it in your {plus?.source === "app_store" ? "App Store" : "Google Play"}{" "}
              account.
            </p>
          ) : (
            <p className="mt-1 text-xs">Cancel anytime from the link in your receipt email.</p>
          )}
        </div>
      ) : !userId ? (
        <Link
          to="/auth"
          search={{ mode: "signin" }}
          className="mt-4 block w-full rounded-full px-4 py-3 text-center text-sm font-black text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          Sign in to get Why? Plus
        </Link>
      ) : isNative === null || forSale === null ? (
        <div className="mt-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      ) : isNative ? (
        nativeStore ? (
          <>
            <button
              type="button"
              onClick={() => setGated("paywall")}
              disabled={busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "See Why? Plus plans"}
            </button>
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="mt-2 w-full text-xs font-bold text-white/70 underline"
            >
              Restore purchases
            </button>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-white/5 p-3 text-center text-sm text-white/70">
            Why? Plus isn't available in this version of the app yet.
          </p>
        )
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose a plan">
            {WEB_PLUS_PLANS.map((p) => {
              const active = webPlan === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setWebPlan(p.id)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active
                      ? "border-amber-300/70 bg-amber-300/15 ring-2 ring-amber-300/40"
                      : "border-white/10 bg-white/5"
                  }`}
                >
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    {p.id === "annual" ? "Yearly · best value" : "Monthly"}
                  </p>
                  <p className="mt-0.5 font-display text-lg font-black text-white">
                    {p.priceString}
                    <span className="text-xs font-bold text-white/60"> / {p.period}</span>
                  </p>
                  <p className="text-[11px] font-bold text-emerald-200">{PLUS_TRIAL_LABEL}</p>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setGated("web-checkout")}
            disabled={busy}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : `Start ${PLUS_TRIAL_LABEL}`}
          </button>
          <p className="mt-3 text-[10px] leading-relaxed text-white/55">
            After the {PLUS_TRIAL_LABEL}, Why? Plus renews automatically at{" "}
            {(WEB_PLUS_PLANS.find((p) => p.id === webPlan) ?? WEB_PLUS_PLANS[0]).priceString} per{" "}
            {(WEB_PLUS_PLANS.find((p) => p.id === webPlan) ?? WEB_PLUS_PLANS[0]).period} until
            cancelled. Cancel anytime from the link in your receipt email.{" "}
            <Link to="/privacy" className="underline">
              Privacy policy
            </Link>
          </p>
        </>
      )}

      <ParentGate
        open={gated !== null}
        onClose={() => setGated(null)}
        onPass={() => {
          const action = gated;
          setGated(null);
          if (action) void run(action);
        }}
      />
    </div>
  );
}
