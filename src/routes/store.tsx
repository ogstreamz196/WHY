import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Lock, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyStats, spendCoins } from "@/lib/account.functions";
import {
  COIN_PACKS,
  STORE_CATALOG,
  getEquipped,
  getInventory,
  getPoints,
  purchaseItem,
  setEquipped,
  type StoreCategory,
  type StoreItem,
} from "@/lib/store";


export const Route = createFileRoute("/store")({
  head: () => ({
    meta: [
      { title: "Store — Why?" },
      { name: "description", content: "Spend Y-coins on avatars, themes and cosmic upgrades — or top up your coin balance." },
      { name: "theme-color", content: "#0b0518" },
    ],
  }),
  component: StorePage,
});

type Tab = StoreCategory | "vip";
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "vip",    label: "VIP & Coins", emoji: "👑" },
  { id: "avatar", label: "Avatars",     emoji: "🧑‍🚀" },
  { id: "theme",  label: "Themes",      emoji: "🎨" },
];


function StorePage() {
  const [tab, setTab] = useState<Tab>("vip");
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [equipped, setEquip] = useState(getEquipped());
  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [confetti, setConfetti] = useState(0);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const { isVip, subscription } = useSubscription(userId);
  const qc = useQueryClient();
  const fetchStats = useServerFn(getMyStats);
  const doSpend = useServerFn(spendCoins);

  const serverStats = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchStats(),
    enabled: !!userId,
  });

  const refresh = () => {
    setCoins(getPoints());
    setInventory(getInventory());
    setEquip(getEquipped());
  };
  useEffect(() => { refresh(); }, []);

  // When signed in, mirror server balance into the local display.
  useEffect(() => {
    if (userId && serverStats.data) setCoins(serverStats.data.total_points);
  }, [userId, serverStats.data]);


  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      setUserEmail(data.user?.email ?? undefined);
    });
  }, []);

  // Success toast + confetti when returning from Paddle checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") === "success") {
      setToast("👑 Welcome to VIP! +500 bonus coins");
      setConfetti((n) => n + 1);
      window.setTimeout(() => setToast(null), 3500);
      // clean the query param
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const buyVip = async () => {
    if (!userId) {
      flash("Please sign in first");
      return;
    }
    try {
      await openCheckout({
        priceId: "vip_monthly",
        customerEmail: userEmail,
        customData: { userId },
        successUrl: `${window.location.origin}/store?checkout=success`,
      });
    } catch (e) {
      console.error(e);
      flash("Checkout failed — try again");
    }
  };


  const buy = async (item: StoreItem) => {
    // Signed-in: check server balance & debit server-side first.
    if (userId) {
      if (coins < item.cost) {
        flash(`Need ${item.cost - coins} more coins`);
        return;
      }
      try {
        const res = await doSpend({ data: { amount: item.cost, reason: `store:${item.id}` } });
        if (!res.ok) {
          flash(`Need ${item.cost - res.total_points} more coins`);
          setCoins(res.total_points);
          return;
        }
        setCoins(res.total_points);
        qc.invalidateQueries({ queryKey: ["stats"] });
      } catch (e) {
        console.error(e);
        flash("Purchase failed — try again");
        return;
      }
      // Grant inventory locally without double-debiting local coins.
      const inv = getInventory();
      if (!inv.includes(item.id)) {
        inv.push(item.id);
        try { window.sessionStorage.setItem("why:inventory", JSON.stringify(inv)); } catch { /* ignore */ }
      }
      setInventory(inv);
      flash(`${item.emoji} ${item.name} unlocked!`);
      return;
    }
    // Guest fallback: local-only.
    const res = purchaseItem(item.id);
    if (!res.ok) {
      flash(
        res.reason === "insufficient_coins"
          ? `Need ${item.cost - coins} more coins`
          : res.reason === "already_owned"
            ? "Already owned"
            : "Item not found",
      );
      return;
    }
    refresh();
    flash(`${item.emoji} ${item.name} unlocked!`);
  };


  const equip = (item: StoreItem) => {
    if (item.category !== "avatar" && item.category !== "theme") return;
    setEquipped({ [item.category]: item.id });
    refresh();
    flash(`${item.emoji} equipped`);
  };

  const items = STORE_CATALOG.filter((i) => tab !== "vip" && i.category === tab);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />
      <PaymentTestModeBanner />

      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center justify-between gap-3">
          <Link to="/" className="glass rounded-2xl px-3 py-1.5 text-sm font-bold text-white/90">
            ← Back
          </Link>
          <h1 className="font-display text-xl font-black tracking-tight text-white">Store</h1>
          <div className="glass inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5">
            <CoinIcon size={18} />
            <motion.span key={coins} initial={{ scale: 1.3 }} animate={{ scale: 1 }} className="text-sm font-black text-white">
              {coins}
            </motion.span>
          </div>
        </header>

        {/* Tabs */}
        <div className="mb-4 grid grid-cols-3 gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-2xl px-2 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                tab === t.id
                  ? "text-white shadow-[var(--shadow-card)]"
                  : "border border-white/10 bg-white/5 text-white/70"
              }`}
              style={tab === t.id ? { background: "var(--gradient-primary)" } : undefined}
            >
              <span className="mr-1" aria-hidden>{t.emoji}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "vip" ? (
          <section className="space-y-3">
            <div className="glass-strong relative overflow-hidden rounded-3xl p-5">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 opacity-60"
                style={{ background: "radial-gradient(circle at 20% 10%, rgba(255,200,80,0.35), transparent 60%), radial-gradient(circle at 90% 90%, rgba(180,80,255,0.25), transparent 60%)" }}
              />
              <div className="flex items-center gap-2">
                <Crown className="h-6 w-6 text-yellow-300" />
                <h2 className="font-display text-2xl font-black text-white">VIP Membership</h2>
              </div>
              <p className="mt-2 text-sm text-white/85">
                Double your coin drops on every fact, quiz and mission — plus a one-time <b>500 coin</b> welcome bonus.
              </p>
              <ul className="mt-3 space-y-1.5 text-sm text-white/85">
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> 2× coins on all activity</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> 500 welcome coins</li>
                <li className="flex items-center gap-2"><Check className="h-4 w-4 text-emerald-300" /> Cancel anytime</li>
              </ul>

              {isVip ? (
                <div className="mt-4 rounded-full bg-emerald-500/20 px-4 py-2.5 text-center text-sm font-black text-emerald-200">
                  ✨ You're a VIP{subscription?.current_period_end ? ` — renews ${new Date(subscription.current_period_end).toLocaleDateString()}` : ""}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={buyVip}
                  disabled={checkoutLoading || !userId}
                  className="mt-4 w-full rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {!userId ? "Sign in to subscribe" : checkoutLoading ? "Opening checkout…" : "Go VIP — $4.99 / month"}
                </button>
              )}
            </div>

            <div className="glass-strong rounded-3xl p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">Earn free coins</p>
              <p className="mt-1 text-sm text-white/90">
                +1 per fact • +2 for revealing • +3 for asking <em>but why?</em> • <b>+25</b> for the Daily Challenge.
              </p>
            </div>
            <p className="pt-2 text-[10px] font-black uppercase tracking-widest text-white/60">Or top up</p>
            {COIN_PACKS.map((pack) => (
              <div key={pack.id} className="glass-strong flex items-center justify-between gap-3 rounded-3xl p-4">
                <div>
                  <p className="font-display text-base font-black text-white">{pack.label}</p>
                  <p className="mt-0.5 inline-flex items-center gap-1.5 text-sm text-white/80">
                    <CoinIcon size={16} />
                    <span className="font-black">{pack.coins.toLocaleString()}</span>
                    {pack.bonus && (
                      <span className="ml-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-black text-emerald-300">
                        +{pack.bonus} bonus
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  disabled
                  title="Payments coming soon"
                  className="rounded-full px-4 py-2 text-sm font-black text-white opacity-60"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  ${pack.priceUSD.toFixed(2)}
                </button>
              </div>
            ))}
            <p className="pt-1 text-center text-[11px] text-white/50">
              💳 Payments coming soon — Stripe checkout will be wired up here.
            </p>
          </section>
        ) : (

          <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {items.map((item) => {
              const owned = inventory.includes(item.id);
              const isEquipped =
                (item.category === "avatar" && equipped.avatar === item.id) ||
                (item.category === "theme" && equipped.theme === item.id);
              const canAfford = coins >= item.cost;
              return (
                <motion.article
                  key={item.id}
                  whileTap={{ scale: 0.97 }}
                  className={`glass-strong relative overflow-hidden rounded-3xl p-3 ${
                    isEquipped ? "ring-2 ring-emerald-400/70" : ""
                  }`}
                >
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -z-10 opacity-40"
                    style={{
                      background:
                        item.gradient ??
                        "radial-gradient(circle at 30% 20%, rgba(255,255,255,0.15), transparent 60%)",
                    }}
                  />
                  <div className="flex h-20 items-center justify-center text-5xl drop-shadow">
                    <span aria-hidden>{item.emoji}</span>
                  </div>
                  <p className="mt-1 truncate font-display text-sm font-black text-white">{item.name}</p>
                  <p className="line-clamp-2 min-h-8 text-[10px] leading-tight text-white/70">{item.description}</p>

                  {owned ? (
                    <button
                      type="button"
                      onClick={() => equip(item)}
                      disabled={isEquipped}
                      className={`mt-2 flex w-full items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-black uppercase tracking-wider transition ${
                        isEquipped
                          ? "bg-emerald-500/20 text-emerald-200"
                          : "bg-white/10 text-white hover:bg-white/20"
                      }`}
                    >
                      {isEquipped ? <><Check className="h-3 w-3" /> Equipped</> : "Equip"}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => buy(item)}
                      disabled={!canAfford}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-full px-2 py-1.5 text-[11px] font-black text-white transition disabled:opacity-50"
                      style={{ background: canAfford ? "var(--gradient-primary)" : "rgba(255,255,255,0.08)" }}
                    >
                      {canAfford ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                      <CoinIcon size={12} />
                      <span>{item.cost}</span>
                    </button>
                  )}
                </motion.article>
              );
            })}
          </section>
        )}
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit rounded-full bg-white/10 px-4 py-2 text-sm font-black text-white backdrop-blur-xl"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfettiBurst trigger={confetti} />
      <BottomNav />
    </main>
  );
}
