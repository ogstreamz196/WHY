import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, Crown, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ParentGate } from "@/components/ParentGate";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { usePlus } from "@/hooks/usePlus";
import { refreshMyPlus } from "@/lib/plus.functions";
import {
  buyPlusPlan,
  isNativePurchasesAvailable,
  loadPlusPlans,
  restorePlus,
  type PlusPlan,
} from "@/lib/nativePurchases";
import { useIsNativeApp } from "@/lib/platform";
import { APPLE_EULA_URL, PLUS_PERKS, PLUS_TRIAL_LABEL, WEB_PLUS_PLANS } from "@/lib/plusPlans";

type Plan = {
  id: "monthly" | "annual";
  priceString: string;
  period: "month" | "year";
  trialLabel: string | null;
  native?: PlusPlan;
  paddlePriceId?: string;
};

/**
 * Why? Plus sign-up and status. Website: Paddle checkout. Android/iOS apps:
 * Google Play / App Store billing through RevenueCat. Every purchase starts
 * with the grown-up check. See docs/WHY_PLUS.md.
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
  const { plus, isPlus, refetch } = usePlus(userId);
  const refresh = useServerFn(refreshMyPlus);
  const { openCheckout } = usePaddleCheckout();
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [selected, setSelected] = useState<Plan["id"]>("annual");
  const [gateOpen, setGateOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const platform =
    typeof window !== "undefined"
      ? (window as { Capacitor?: { getPlatform?: () => string } }).Capacitor?.getPlatform?.()
      : undefined;

  useEffect(() => {
    if (isNative === null) return;
    if (!isNative) {
      setPlans(WEB_PLUS_PLANS.map((p) => ({ ...p, trialLabel: PLUS_TRIAL_LABEL })));
      return;
    }
    if (!userId || !isNativePurchasesAvailable()) {
      setPlans([]);
      return;
    }
    loadPlusPlans(userId)
      .then((ps) =>
        setPlans(
          ps.map((p) => ({
            id: p.id,
            priceString: p.priceString,
            period: p.id === "annual" ? "year" : "month",
            trialLabel: p.trialLabel,
            native: p,
          })),
        ),
      )
      .catch((e) => {
        console.warn("[plus] couldn't load store plans", e);
        setPlans([]);
      });
  }, [isNative, userId]);

  const plan = plans?.find((p) => p.id === selected) ?? plans?.[0];

  async function purchase() {
    if (!userId || !plan) return;
    setBusy(true);
    try {
      if (plan.native) {
        const bought = await buyPlusPlan(userId, plan.native);
        if (!bought) return;
        const status = await refresh();
        await refetch();
        if (status.active) {
          onActivated?.();
          toast.success("✨ Welcome to Why? Plus!");
        } else {
          toast("Thanks! Your Plus will switch on in a moment.");
        }
      } else if (plan.paddlePriceId) {
        await openCheckout({
          priceId: plan.paddlePriceId,
          customerEmail: userEmail,
          customData: { userId },
          successUrl: `${window.location.origin}/store?checkout=success`,
        });
      }
    } catch (e) {
      console.error(e);
      toast.error("Checkout didn't open — please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    if (!userId) return;
    setBusy(true);
    try {
      await restorePlus(userId);
      const status = await refresh();
      await refetch();
      toast(
        status.active ? "✨ Why? Plus restored!" : "No Why? Plus purchase found for this account.",
      );
    } catch (e) {
      console.error(e);
      toast.error("Couldn't restore purchases — please try again.");
    } finally {
      setBusy(false);
    }
  }

  const manageHint =
    plus?.source === "app_store"
      ? { href: "https://apps.apple.com/account/subscriptions", label: "Manage in the App Store" }
      : plus?.source === "play_store"
        ? {
            href: "https://play.google.com/store/account/subscriptions?package=com.ogstreamz196.why",
            label: "Manage in Google Play",
          }
        : null;

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
          {manageHint ? (
            <a href={manageHint.href} className="mt-1 inline-block text-xs font-bold underline">
              {manageHint.label}
            </a>
          ) : (
            plus?.source === "web" && (
              <p className="mt-1 text-xs">Cancel anytime from the link in your receipt email.</p>
            )
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
      ) : plans === null ? (
        <div className="mt-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-white/60" />
        </div>
      ) : plans.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-white/5 p-3 text-center text-sm text-white/70">
          Why? Plus isn't available here yet. Check back soon!
        </p>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Choose a plan">
            {plans.map((p) => {
              const active = plan?.id === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setSelected(p.id)}
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
                  {p.trialLabel && (
                    <p className="text-[11px] font-bold text-emerald-200">{p.trialLabel}</p>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => setGateOpen(true)}
            disabled={busy || !plan}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : plan?.trialLabel ? (
              `Start ${plan.trialLabel}`
            ) : (
              `Get Why? Plus — ${plan?.priceString} / ${plan?.period}`
            )}
          </button>
          {isNative && (
            <button
              type="button"
              onClick={restore}
              disabled={busy}
              className="mt-2 w-full text-xs font-bold text-white/70 underline"
            >
              Restore purchases
            </button>
          )}
          {plan && (
            <p className="mt-3 text-[10px] leading-relaxed text-white/55">
              {plan.trialLabel ? `After the ${plan.trialLabel}, ` : ""}Why? Plus renews
              automatically at {plan.priceString} per {plan.period} until cancelled.{" "}
              {isNative
                ? `Payment is charged to your ${platform === "ios" ? "Apple ID" : "Google Play"} account. Cancel at least 24 hours before the end of a period to avoid the next charge; manage it in your ${platform === "ios" ? "App Store" : "Google Play"} account settings.`
                : "Cancel anytime from the link in your receipt email."}{" "}
              <Link to="/privacy" className="underline">
                Privacy policy
              </Link>
              {platform === "ios" && (
                <>
                  {" · "}
                  <a href={APPLE_EULA_URL} className="underline">
                    Terms of use
                  </a>
                </>
              )}
            </p>
          )}
        </>
      )}

      <ParentGate
        open={gateOpen}
        onClose={() => setGateOpen(false)}
        onPass={() => {
          setGateOpen(false);
          void purchase();
        }}
      />
    </div>
  );
}
