import { createFileRoute, Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { Check, Crown, Gift, Lock, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast as sonner } from "sonner";
import { CoinIcon } from "@/components/CoinIcon";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";
import { AvatarFigure } from "@/components/AvatarFigure";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { RewardReveal, type RevealPrize } from "@/components/RewardReveal";
import { useIsNativeApp } from "@/lib/platform";
import { usePlus } from "@/hooks/usePlus";
import { useDressUp, useMyAvatar, useWeeklyDrop } from "@/hooks/useMyAvatar";
import { PlusPanel } from "@/components/PlusPanel";
import { isNativePurchasesAvailable } from "@/lib/nativePurchases";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyInventory, getMyStats, purchaseStoreItem } from "@/lib/account.functions";
import {
  STORE_CATALOG,
  getEquipped,
  getInventory,
  getPoints,
  purchaseItem,
  setEquipped,
  setOwnedItems,
  type StoreCategory,
  type StoreItem,
} from "@/lib/store";
import { RARITY_STYLE, rarityOf, type Outfit, type OutfitSlot } from "@/lib/avatarItems";
import { PLUS_TRIAL_LABEL } from "@/lib/plusPlans";
import { previewTheme } from "@/lib/useEquippedTheme";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/store")({
  head: () =>
    seo({
      title: "Avatar store: dress up your explorer | Why?",
      description:
        "Spend the coins you earn by learning on characters, hats, pets, auras and themes for your Why? avatar. Coins can't be bought.",
      path: "/store",
      themeColor: "#0b0518",
    }),
  component: StorePage,
});

type Tab = Exclude<StoreCategory, "boost"> | "vip";
const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "avatar", label: "Characters", emoji: "🦊" },
  { id: "hat", label: "Hats", emoji: "🎩" },
  { id: "face", label: "Face", emoji: "🕶️" },
  { id: "hand", label: "Hands", emoji: "⚔️" },
  { id: "neck", label: "Bling", emoji: "💎" },
  { id: "pet", label: "Pets", emoji: "🐉" },
  { id: "aura", label: "Auras", emoji: "✨" },
  { id: "theme", label: "Themes", emoji: "🎨" },
  { id: "vip", label: "Why? Plus", emoji: "👑" },
];

const isWearable = (i: StoreItem): i is StoreItem & { category: OutfitSlot } =>
  i.category !== "avatar" && i.category !== "theme" && i.category !== "boost";

function StorePage() {
  const [tab, setTab] = useState<Tab>("avatar");
  // Why? Plus is sold with Paddle on the website and with Google Play / App
  // Store billing in the apps; app builds without the RevenueCat plugin hide it.
  const isNative = useIsNativeApp();
  const [nativePlus, setNativePlus] = useState(false);
  useEffect(() => setNativePlus(isNativePurchasesAvailable()), []);
  const plusAvailable = isNative === false || (isNative === true && nativePlus);
  const visibleTabs = TABS.filter((t) => t.id !== "vip" || plusAvailable);
  const [coins, setCoins] = useState(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [theme, setTheme] = useState<string | undefined>(undefined);
  const [toast, setToast] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);
  const [confetti, setConfetti] = useState(0);
  const [tryOn, setTryOn] = useState<StoreItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [prize, setPrize] = useState<RevealPrize | null>(null);
  const plusRef = useRef<HTMLDivElement | null>(null);
  const { isPlus: isVip } = usePlus(userId);
  const avatar = useMyAvatar(userId);
  const dressUp = useDressUp(userId);
  const drop = useWeeklyDrop(userId);
  const qc = useQueryClient();
  const fetchStats = useServerFn(getMyStats);
  const doPurchase = useServerFn(purchaseStoreItem);
  const fetchInventory = useServerFn(getMyInventory);

  const serverStats = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchStats(),
    enabled: !!userId,
  });

  const refresh = () => {
    setCoins(getPoints());
    setInventory(getInventory());
    setTheme(getEquipped().theme);
  };
  useEffect(() => {
    refresh();
  }, []);

  // Theme previews must never get stuck: clear them when leaving the Themes
  // tab, when the window loses focus and when the store closes.
  useEffect(() => {
    if (tab !== "theme") {
      previewTheme(null);
      return;
    }
    const reset = () => previewTheme(null);
    window.addEventListener("blur", reset);
    document.addEventListener("visibilitychange", reset);
    return () => {
      window.removeEventListener("blur", reset);
      document.removeEventListener("visibilitychange", reset);
      previewTheme(null);
    };
  }, [tab]);

  // Signed-in users' purchases live on the server; mirror them into the local cache.
  const serverInventory = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetchInventory(),
    enabled: !!userId,
  });
  useEffect(() => {
    if (userId && serverInventory.data) {
      setOwnedItems(serverInventory.data);
      setInventory(getInventory());
    }
  }, [userId, serverInventory.data]);

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
      setTab("vip");
      setToast("✨ Welcome to Why? Plus!");
      setConfetti((n) => n + 1);
      window.setTimeout(() => setToast(null), 3500);
      const url = new URL(window.location.href);
      url.searchParams.delete("checkout");
      window.history.replaceState({}, "", url.toString());
    }
  }, []);

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const goToPlus = () => {
    setTab("vip");
    setTryOn(null);
    window.setTimeout(
      () => plusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      50,
    );
  };

  const isOwned = (item: StoreItem) => inventory.includes(item.id) || (isVip && !!item.vipOnly);
  const isWorn = (item: StoreItem) =>
    item.category === "avatar"
      ? avatar.avatarId === item.id
      : item.category === "theme"
        ? theme === item.id
        : isWearable(item) && avatar.outfit[item.category] === item.id;

  async function wear(item: StoreItem, on = true) {
    if (item.category === "theme") {
      setEquipped({ theme: item.id });
      refresh();
      flash(`${item.emoji} theme on`);
      return;
    }
    setBusyId(item.id);
    try {
      await dressUp(item, on);
      setTryOn(null);
      flash(on ? `${item.emoji} ${item.name} on!` : `${item.name} off`);
    } catch (e) {
      flash(e instanceof Error ? e.message : "Couldn't change that — try again");
    } finally {
      setBusyId(null);
    }
  }

  async function buy(item: StoreItem) {
    if (coins < item.cost) {
      flash(`Need ${item.cost - coins} more coins`);
      return;
    }
    setBusyId(item.id);
    try {
      if (userId) {
        const res = await doPurchase({ data: { item_id: item.id } });
        setCoins(res.total_points);
        if (!res.ok) {
          flash(
            res.reason === "insufficient_coins"
              ? `Need ${item.cost - res.total_points} more coins`
              : res.reason === "already_owned"
                ? "Already yours"
                : "That item isn't for sale",
          );
          return;
        }
        setOwnedItems(Array.from(new Set([...getInventory(), item.id])));
        setInventory(getInventory());
        void qc.invalidateQueries({ queryKey: ["stats"] });
        void qc.invalidateQueries({ queryKey: ["inventory"] });
      } else {
        const res = purchaseItem(item.id);
        if (!res.ok) {
          flash(res.reason === "insufficient_coins" ? "Not enough coins" : "Already yours");
          return;
        }
        refresh();
      }
    } catch (e) {
      console.error(e);
      flash("Purchase failed — try again");
      return;
    } finally {
      setBusyId(null);
    }
    setConfetti((n) => n + 1);
    flash(`${item.emoji} ${item.name} is yours!`);
    // Put it straight on, like trying it on in a shop.
    if (item.category !== "boost") await wear(item);
  }

  async function claimDrop() {
    if (!drop) return;
    try {
      const ok = await drop.claim();
      setInventory(getInventory());
      if (ok) setPrize({ kind: "item", item: drop.item });
      else flash("You already have this week's drop!");
    } catch (e) {
      console.error(e);
      flash("Couldn't claim the drop — try again");
    }
  }

  // What the studio shows: what you're wearing, plus whatever you're trying on.
  const studioAvatar = tryOn?.category === "avatar" ? tryOn.id : avatar.avatarId;
  const studioOutfit: Outfit =
    tryOn && isWearable(tryOn) ? { ...avatar.outfit, [tryOn.category]: tryOn.id } : avatar.outfit;
  const wornItems = (Object.values(avatar.outfit) as string[])
    .map((id) => STORE_CATALOG.find((i) => i.id === id))
    .filter((i): i is StoreItem => !!i);

  const items =
    tab === "vip"
      ? []
      : STORE_CATALOG.filter((i) => i.category === tab).sort(
          (a, b) =>
            Number(!!a.dropOnly) - Number(!!b.dropOnly) ||
            Number(!!a.vipOnly) - Number(!!b.vipOnly) ||
            a.cost - b.cost,
        );

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28 wide:pb-8">
      <CosmicBackground />
      {isNative === false && <PaymentTestModeBanner />}

      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 wide:grid wide:max-w-6xl wide:grid-cols-[300px_minmax(0,1fr)] wide:content-start wide:items-start wide:gap-x-8 lg:px-8 xl:grid-cols-[360px_minmax(0,1fr)] 2xl:max-w-7xl short:min-h-0">
        <header className="mb-3 flex items-center justify-between gap-3 wide:col-span-2 wide:row-start-1 wide:mb-5">
          <Link to="/" className="glass rounded-2xl px-3 py-1.5 text-sm font-bold text-white/90">
            ← Back
          </Link>
          <h1 className="font-display text-xl font-black tracking-tight text-white">Store</h1>
          <div className="glass inline-flex items-center gap-1.5 rounded-2xl px-3 py-1.5">
            <CoinIcon size={18} />
            <motion.span
              key={coins}
              initial={{ scale: 1.3 }}
              animate={{ scale: 1 }}
              className="text-sm font-black text-white"
            >
              {coins}
            </motion.span>
          </div>
        </header>

        {/* Wide screens: the studio, Plus and the weekly drop stay in view on the left. */}
        <div className="own-heading-sizes contents wide:sticky wide:top-4 wide:col-start-1 wide:row-start-2 wide:block wide:max-h-[calc(100dvh-2rem)] wide:overflow-y-auto wide:[scrollbar-width:none]">
          {/* ── Why? Plus banner: easy to find, but calm (it's for parents) ── */}
          {plusAvailable && !isVip && tab !== "vip" && (
            <motion.button
              type="button"
              onClick={goToPlus}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              whileTap={{ scale: 0.98 }}
              className="relative mb-3 flex w-full flex-wrap items-center gap-3 overflow-hidden rounded-3xl border border-amber-300/50 bg-gradient-to-r from-amber-500/30 via-orange-500/20 to-fuchsia-600/30 p-4 text-left shadow-[0_0_30px_rgba(251,191,36,0.25)]"
            >
              <motion.span
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-1/4 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                animate={{ x: ["-150%", "450%"] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
              />
              <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-300 to-yellow-500 shadow-lg">
                <Crown className="h-7 w-7 text-amber-950" aria-hidden />
              </span>
              <span className="relative min-w-0 flex-1">
                <span className="block font-display text-lg font-black leading-tight text-white">
                  Why? Plus
                </span>
                <span className="block text-xs text-white/85">
                  100 deep dives an hour, Plus-only avatars and auras.
                  {isNative === false ? ` ${PLUS_TRIAL_LABEL}.` : ""}
                </span>
              </span>
              <span className="relative shrink-0 rounded-full bg-white px-3 py-1.5 text-xs font-black text-amber-900 wide:w-full wide:py-2 wide:text-center">
                See plans
              </span>
            </motion.button>
          )}

          {/* ── Avatar Studio ── */}
          {tab !== "vip" && tab !== "theme" && (
            <section
              className="glass-strong relative mb-3 overflow-hidden rounded-3xl border border-white/10 p-4"
              aria-label="Avatar studio"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 opacity-50"
                style={{
                  background:
                    "radial-gradient(circle at 30% 30%, rgba(168,85,247,0.35), transparent 60%), radial-gradient(circle at 80% 80%, rgba(34,211,238,0.25), transparent 55%)",
                }}
              />
              <div className="relative flex items-center gap-4 wide:flex-col wide:items-stretch">
                <motion.div
                  key={tryOn?.id ?? "worn"}
                  initial={{ scale: 0.85, rotate: -4 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 16 }}
                  className="flex h-36 w-36 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-black/20 wide:h-56 wide:w-full short:h-36"
                >
                  <AvatarFigure
                    avatarId={studioAvatar}
                    outfit={studioOutfit}
                    className="text-7xl wide:text-[7.5rem] short:text-7xl"
                  />
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                    {tryOn ? "Trying on" : "Avatar studio"}
                  </p>
                  {tryOn ? (
                    <>
                      <p className="truncate font-display text-lg font-black text-white">
                        {tryOn.emoji} {tryOn.name}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-white/70">
                        {tryOn.description}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <ItemAction
                          item={tryOn}
                          owned={isOwned(tryOn)}
                          worn={isWorn(tryOn)}
                          coins={coins}
                          busy={busyId === tryOn.id}
                          plusAvailable={plusAvailable}
                          onBuy={buy}
                          onWear={wear}
                          onPlus={goToPlus}
                        />
                        <button
                          type="button"
                          onClick={() => setTryOn(null)}
                          className="rounded-full bg-white/10 px-3 py-1.5 text-[11px] font-black text-white/80"
                        >
                          Back
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-base font-black leading-tight text-white">
                        Tap anything to try it on!
                      </p>
                      <p className="mt-1 text-xs text-white/70">
                        Mix characters, hats, swords, flowers, bling, pets and auras. Your look
                        shows on the Ranks page and your profile.
                      </p>
                      {wornItems.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {wornItems.map((i) => (
                            <button
                              key={i.id}
                              type="button"
                              onClick={() => wear(i, false)}
                              disabled={busyId === i.id}
                              aria-label={`Take off ${i.name}`}
                              className="rounded-full bg-white/10 px-2 py-0.5 text-xs font-bold text-white/85"
                            >
                              {i.emoji} ✕
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* ── This week's free drop ── */}
          {drop && !drop.claimed && tab !== "vip" && (
            <motion.button
              type="button"
              onClick={claimDrop}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative mb-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-fuchsia-300/40 bg-gradient-to-r from-fuchsia-500/25 via-violet-500/20 to-sky-500/25 px-4 py-3 text-left"
            >
              <motion.span
                aria-hidden
                className="text-3xl"
                animate={{ rotate: [0, -10, 10, -6, 6, 0], scale: [1, 1.1, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.4 }}
              >
                🎁
              </motion.span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-black uppercase tracking-widest text-fuchsia-200">
                  Free special drop
                </span>
                <span className="block text-sm font-black text-white">
                  A mystery item you can't buy. Open it!
                </span>
              </span>
              <Gift className="h-5 w-5 text-white/80" aria-hidden />
            </motion.button>
          )}
        </div>

        {/* Wide screens: sections and items fill the right. */}
        <div className="contents wide:col-start-2 wide:row-start-2 wide:block">
          {/* Tabs */}
          <nav
            className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 wide:sticky wide:top-0 wide:z-10 wide:-mx-2 wide:rounded-2xl wide:bg-black/40 wide:p-2 wide:backdrop-blur-xl"
            aria-label="Store sections"
          >
            {visibleTabs.map((t) => {
              const active = tab === t.id;
              const plus = t.id === "vip";
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => (plus ? goToPlus() : (setTab(t.id), setTryOn(null)))}
                  aria-pressed={active}
                  className={`shrink-0 rounded-2xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                    active
                      ? "text-white shadow-[var(--shadow-card)]"
                      : plus
                        ? "border border-amber-300/50 bg-amber-300/15 text-amber-100"
                        : "border border-white/10 bg-white/5 text-white/70"
                  }`}
                  style={
                    active
                      ? {
                          background: plus
                            ? "linear-gradient(135deg, #f59e0b, #f97316)"
                            : "var(--gradient-primary)",
                        }
                      : undefined
                  }
                >
                  <span className="mr-1" aria-hidden>
                    {t.emoji}
                  </span>
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Content */}
          {tab === "vip" && plusAvailable ? (
            <section className="space-y-3" ref={plusRef}>
              <PlusPanel
                userId={userId}
                userEmail={userEmail}
                onActivated={() => setConfetti((n) => n + 1)}
              />
              <div className="glass-strong rounded-3xl p-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                  Earn coins by exploring
                </p>
                <p className="mt-1 text-sm text-white/90">
                  Coins come from reading facts, asking <em>but why?</em>, quizzes, missions and the
                  Daily Challenge. They can't be bought.
                </p>
              </div>
            </section>
          ) : (
            <section
              className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 wide:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6"
              onPointerLeave={tab === "theme" ? () => previewTheme(null) : undefined}
            >
              {items.map((item, idx) => {
                const owned = isOwned(item);
                const worn = isWorn(item);
                const rarity = rarityOf(item);
                const trying = tryOn?.id === item.id;
                const isTheme = item.category === "theme";
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                    whileTap={{ scale: 0.95 }}
                    className={`glass-strong relative flex flex-col overflow-hidden rounded-2xl p-2 ring-1 ${RARITY_STYLE[rarity].ring} ${
                      worn ? "ring-2 ring-emerald-400/80" : ""
                    } ${trying ? "ring-2 ring-white/80" : ""}`}
                    onMouseEnter={isTheme ? () => previewTheme(item.id) : undefined}
                    onMouseLeave={isTheme ? () => previewTheme(null) : undefined}
                  >
                    {worn && (
                      <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-emerald-400/90 p-0.5 text-emerald-950">
                        <Check className="h-2.5 w-2.5" aria-label="Wearing" />
                      </span>
                    )}
                    {item.vipOnly && (
                      <span className="absolute left-1.5 top-1.5 z-10 flex items-center gap-0.5 rounded-full bg-gradient-to-r from-amber-400 to-yellow-300 px-1.5 py-0.5 text-[8px] font-black uppercase text-amber-950">
                        <Crown className="h-2 w-2" aria-hidden /> Plus
                      </span>
                    )}
                    {item.dropOnly && (
                      <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-fuchsia-400 px-1.5 py-0.5 text-[8px] font-black uppercase text-fuchsia-950">
                        Drop
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (isTheme) previewTheme(item.id);
                        else setTryOn(trying ? null : item);
                      }}
                      onFocus={isTheme ? () => previewTheme(item.id) : undefined}
                      onBlur={isTheme ? () => previewTheme(null) : undefined}
                      aria-label={isTheme ? `Preview ${item.name} theme` : `Try on ${item.name}`}
                      className="relative flex h-16 items-center justify-center rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                      style={{
                        background:
                          item.gradient ??
                          "radial-gradient(circle at 50% 40%, rgba(255,255,255,0.12), transparent 70%)",
                      }}
                    >
                      {item.category === "avatar" ? (
                        <AnimatedAvatar avatarId={item.id} className="text-4xl" />
                      ) : (
                        <span className="text-4xl leading-none" aria-hidden>
                          {item.emoji}
                        </span>
                      )}
                    </button>
                    <p className="mt-1 truncate text-center text-[11px] font-black text-white">
                      {item.name}
                    </p>
                    <p
                      className={`text-center text-[8px] font-black uppercase tracking-widest ${RARITY_STYLE[rarity].text}`}
                    >
                      {item.dropOnly ? "Special drop" : RARITY_STYLE[rarity].label}
                    </p>
                    <div className="mt-1.5">
                      <ItemAction
                        item={item}
                        owned={owned}
                        worn={worn}
                        coins={coins}
                        busy={busyId === item.id}
                        plusAvailable={plusAvailable}
                        onBuy={buy}
                        onWear={wear}
                        onPlus={goToPlus}
                        compact
                      />
                    </div>
                  </motion.article>
                );
              })}
            </section>
          )}
        </div>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90vw] rounded-full bg-black/70 px-4 py-2 text-center text-sm font-black text-white backdrop-blur-xl"
            role="status"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      <RewardReveal
        prize={prize}
        title="This week's special drop"
        avatar={avatar}
        onWear={async (item) => {
          try {
            await dressUp(item);
            sonner.success(`${item.emoji} ${item.name} on!`);
          } catch (e) {
            sonner.error(e instanceof Error ? e.message : "Couldn't put that on");
          }
        }}
        onClose={() => setPrize(null)}
      />
      <ConfettiBurst trigger={confetti} />
      <BottomNav />
    </main>
  );
}

function ItemAction({
  item,
  owned,
  worn,
  coins,
  busy,
  plusAvailable,
  onBuy,
  onWear,
  onPlus,
  compact,
}: {
  item: StoreItem;
  owned: boolean;
  worn: boolean;
  coins: number;
  busy: boolean;
  plusAvailable: boolean;
  onBuy: (i: StoreItem) => void;
  onWear: (i: StoreItem, on?: boolean) => void;
  onPlus: () => void;
  compact?: boolean;
}) {
  const base = `flex items-center justify-center gap-1 rounded-full font-black uppercase tracking-wider transition disabled:opacity-60 ${
    compact ? "w-full px-1.5 py-1 text-[10px]" : "px-3 py-1.5 text-[11px]"
  }`;
  if (owned) {
    const canTakeOff = worn && item.category !== "avatar" && item.category !== "theme";
    if (worn && !canTakeOff) {
      return (
        <span className={`${base} bg-emerald-500/20 text-emerald-200`}>
          <Check className="h-3 w-3" /> On
        </span>
      );
    }
    return (
      <button
        type="button"
        disabled={busy}
        onClick={() => onWear(item, !worn)}
        className={`${base} ${worn ? "bg-emerald-500/20 text-emerald-200" : "bg-white/15 text-white"}`}
      >
        {worn ? "Take off" : "Wear"}
      </button>
    );
  }
  if (item.vipOnly) {
    return (
      <button
        type="button"
        onClick={onPlus}
        disabled={!plusAvailable}
        className={`${base} bg-amber-300/20 text-amber-100`}
      >
        <Crown className="h-3 w-3" aria-hidden /> Plus
      </button>
    );
  }
  if (item.dropOnly) {
    return (
      <span className={`${base} bg-fuchsia-400/15 text-fuchsia-100`}>
        <Gift className="h-3 w-3" aria-hidden /> Drops only
      </span>
    );
  }
  const canAfford = coins >= item.cost;
  return (
    <button
      type="button"
      onClick={() => onBuy(item)}
      disabled={!canAfford || busy}
      className={`${base} text-white`}
      style={{ background: canAfford ? "var(--gradient-primary)" : "rgba(255,255,255,0.08)" }}
    >
      {canAfford ? <Sparkles className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
      <CoinIcon size={11} />
      {item.cost}
    </button>
  );
}
