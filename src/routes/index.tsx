import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookmarkPlus,
  BookmarkCheck,
  Flame,
  Heart,
  Search as SearchIcon,
  Share2,
  Sparkles,
  Star,
  User as UserIcon,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateAndStoreFact,
  generateWhyLayer,
  getRandomFact,
  searchOrGenerateFact,
  type Fact,
} from "@/lib/facts.functions";
import {
  addPoints,
  bumpSeen,
  cacheFact,
  getCachedRandomFact,
  getFavorites,
  getPoints,
  getStreak,
  isFavorite,
  toggleFavorite,
} from "@/lib/store";
import { CATEGORIES, emojiFor, gradientFor, type CategoryKey } from "@/lib/categories";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { Celebration } from "@/components/Celebration";
import { DailyChallenge } from "@/components/DailyChallenge";
import { CoinIcon } from "@/components/CoinIcon";
import { SignInPrompt } from "@/components/SignInPrompt";
import { useCurrentUser } from "@/lib/auth";
import {
  getMyProfile,
  getMyStats,
  migrateGuestData,
  recordDiscovery,
  recordDailyChallenge,
  toggleFavorite as toggleFavoriteServer,
} from "@/lib/account.functions";


import mascotImg from "@/assets/mascot.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Why? — A pocket-sized universe of curiosity" },
      { name: "description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
      { property: "og:title", content: "Why? — A pocket-sized universe of curiosity" },
      { property: "og:description", content: "Tap Next for a new 'Do you know why…' fact." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: WhyApp,
});

type Reaction = "like" | "love" | null;

function WhyApp() {
  const getRandom = useServerFn(getRandomFact);
  const generateNew = useServerFn(generateAndStoreFact);
  const generateLayer = useServerFn(generateWhyLayer);
  const searchOrGen = useServerFn(searchOrGenerateFact);
  const migrateGuest = useServerFn(migrateGuestData);
  const fetchProfile = useServerFn(getMyProfile);
  const fetchStats = useServerFn(getMyStats);
  const recordDailyServer = useServerFn(recordDailyChallenge);
  const recordDiscoveryServer = useServerFn(recordDiscovery);
  const toggleFavServer = useServerFn(toggleFavoriteServer);

  const { user, isGuest } = useCurrentUser();

  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [fav, setFav] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [level, setLevel] = useState(1);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [signInPrompt, setSignInPrompt] = useState<null | { title: string; message: string }>(null);
  const [celebrate, setCelebrate] = useState<{ points: number } | null>(null);

  const nextGenAt = useRef<number>(4 + Math.floor(Math.random() * 7));
  const tapCount = useRef<number>(0);
  const lastMilestone = useRef<number>(0);

  const [chain, setChain] = useState<{ question: string; answer: string; terminal?: boolean }[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // Local (guest) initial hydration
  useEffect(() => {
    const p = getPoints();
    setPoints(p);
    setLevel(Math.max(1, Math.floor(p / 100) + 1));
    setStreak(getStreak());
  }, []);

  // On sign-in: migrate any local guest state up to the server (once), then load
  // authoritative profile + stats from the server.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const migratedKey = `why:migrated:${user.id}`;
        if (typeof window !== "undefined" && !localStorage.getItem(migratedKey)) {
          const favs = getFavorites();
          await migrateGuest({
            data: {
              points: getPoints(),
              streak: getStreak(),
              favorite_fact_ids: favs.map((f) => f.id).slice(0, 500),
            },
          }).catch((e) => console.warn("guest migration failed", e));
          localStorage.setItem(migratedKey, "1");
        }
        const [profile, stats] = await Promise.all([fetchProfile(), fetchStats()]);
        if (cancelled) return;
        setDisplayName(profile?.display_name ?? user.email?.split("@")[0] ?? null);
        setPoints(stats.total_points);
        setStreak(stats.current_streak);
        setLevel(Math.max(1, Math.floor(stats.total_points / 100) + 1));
      } catch (e) {
        console.warn("account load failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, migrateGuest, fetchProfile, fetchStats]);


  const grantPoints = useCallback((delta: number) => {
    const prev = getPoints();
    const next = addPoints(delta);
    setPoints(next);
    const newLevel = Math.max(1, Math.floor(next / 100) + 1);
    setLevel(newLevel);
    // Milestones: every 50 pts (but not more than once per crossing)
    const crossed = Math.floor(next / 50) > Math.floor(prev / 50);
    if (crossed && next - lastMilestone.current >= 50) {
      lastMilestone.current = next;
      setCelebrate({ points: 50 });
    }
  }, []);

  const showFact = useCallback((f: Fact | null) => {
    setFact(f);
    setRevealed(false);
    setChain([]);
    setReaction(null);
    setFav(f ? isFavorite(f.id) : false);
    if (f) cacheFact(f);
  }, []);

  const loadNext = useCallback(
    async (currentId?: string, opts?: { forceGenerate?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        tapCount.current += 1;
        const cat = category === "all" ? undefined : category;
        const shouldGenerate =
          opts?.forceGenerate ||
          tapCount.current >= nextGenAt.current ||
          Math.random() < 0.05;

        let next: Fact | null = null;
        if (shouldGenerate) {
          try { next = await generateNew({ data: { category: cat } }); } catch (e) { console.warn(e); }
          if (next) { tapCount.current = 0; nextGenAt.current = 4 + Math.floor(Math.random() * 7); }
        }
        if (!next) next = await getRandom({ data: { excludeId: currentId, category: cat } });
        if (!next) {
          const cached = getCachedRandomFact(currentId);
          if (cached) next = cached;
        }
        showFact(next);
        bumpSeen();
        grantPoints(1);
        if (user && next?.id) {
          recordDiscoveryServer({ data: { fact_id: next.id } }).catch((e) => console.warn(e));
        }
      } catch (err) {
        console.error(err);
        const cached = getCachedRandomFact(currentId);
        if (cached) { showFact(cached); setError("You're offline — showing a cached fact."); }
        else setError("Couldn't load a fact. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [category, generateNew, getRandom, showFact, grantPoints, user, recordDiscoveryServer],
  );

  useEffect(() => { void loadNext(); /* eslint-disable-line */ }, []);
  useEffect(() => { void loadNext(fact?.id); /* eslint-disable-line */ }, [category]);

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    grantPoints(2);
  };

  const askWhy = async () => {
    if (!fact) return;
    setChainLoading(true);
    try {
      const prev = chain.flatMap((c) => [c.question, c.answer]);
      const layer = await generateLayer({
        data: { rootQuestion: fact.question, previousChain: prev },
      });
      if (layer) {
        setChain((c) => [...c, layer]);
        grantPoints(3);
      }
    } catch (e) { console.warn(e); }
    finally { setChainLoading(false); }
  };

  const handleShare = async () => {
    if (!fact) return;
    const url = typeof window !== "undefined" ? window.location.origin : "https://why.app";
    const text = `🤔 WHY?\n\nDo you know why ${fact.question}\n\nTap to discover.\n${url}`;
    try {
      if (navigator.share) await navigator.share({ title: "Why?", text, url });
      else { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
    } catch { /* cancelled */ }
  };

  const handleFav = () => {
    if (!fact) return;
    if (isGuest) {
      setSignInPrompt({
        title: "Save your favourites",
        message: "Sign up to keep your favourite whys across every device.",
      });
      return;
    }
    const now = toggleFavorite(fact);
    setFav(now);
    if (now) grantPoints(1);
    toggleFavServer({ data: { fact_id: fact.id } }).catch((e) => console.warn(e));
  };

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const f = await searchOrGen({ data: { query: q } });
      if (f) { showFact(f); setSearch(""); setSearchOpen(false); }
      else setError("Couldn't find or make a fact for that. Try another question!");
    } catch (err) {
      console.error(err); setError("Search failed. Try again in a moment.");
    } finally { setSearching(false); }
  };

  const levelXP = points % 100;
  const catGradient = gradientFor(fact?.category);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />

      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        {/* ── GAMIFIED HEADER ─────────────────────────────── */}
        <header className="mb-3 flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-foreground/90 transition active:scale-95"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
            </button>

            <div className="flex items-center gap-1.5">
              <div className="glass flex items-center gap-1.5 rounded-2xl px-3 py-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-black text-white">{streak}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">day</span>
              </div>
              <Link
                to={user ? "/profile" : "/auth"}
                aria-label={user ? "Open profile" : "Sign in"}
                className="glass flex h-11 w-11 items-center justify-center rounded-2xl overflow-hidden active:scale-95 transition"
              >
                {user ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: "var(--gradient-primary)" }}>
                    <span className="font-black text-white">{(displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}</span>
                  </span>
                ) : (
                  <img src={mascotImg} alt="" className="h-10 w-10 object-contain animate-float-slow" />
                )}
              </Link>
              <div className="glass flex items-center gap-1.5 rounded-2xl px-3 py-1.5">
                <CoinIcon size={16} />
                <motion.span key={points} initial={{ scale: 1.4, y: -4 }} animate={{ scale: 1, y: 0 }} className="text-sm font-black text-white">
                  {points}
                </motion.span>
              </div>
            </div>
          </div>

          {/* XP bar */}
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-white/60">
              Lvl {level}
            </span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ background: "var(--gradient-primary)" }}
                animate={{ width: `${levelXP}%` }}
                transition={{ type: "spring", stiffness: 120, damping: 20 }}
              />
            </div>
            <span className="text-[10px] font-bold text-white/50">{levelXP}/100</span>
          </div>

          {/* Search sheet */}
          <AnimatePresence>
            {searchOpen && (
              <motion.form
                onSubmit={doSearch}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="glass mt-1 flex items-center gap-2 rounded-2xl p-1.5">
                  <SearchIcon className="ml-2 h-4 w-4 text-white/60" />
                  <input
                    autoFocus
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Ask a why question…"
                    maxLength={200}
                    className="flex-1 bg-transparent px-1 py-2 text-base text-white placeholder-white/40 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={searching || search.trim().length < 2}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {searching ? "…" : "Ask"}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>
        </header>

        {/* Welcome / signup banner */}
        {user ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2 text-sm"
          >
            <span className="text-white/80">Welcome back, </span>
            <span className="font-black text-white">{displayName ?? "explorer"}</span>
            <span className="text-white/60"> — your streak is safe.</span>
          </motion.div>
        ) : (
          <button
            type="button"
            onClick={() => setSignInPrompt({ title: "Save your streak", message: "Create an account to keep your streak, coins and favourites forever." })}
            className="mb-3 flex w-full items-center justify-between gap-2 rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-2 text-left text-sm"
          >
            <span className="text-white/90">
              <span className="font-black">Save your curiosity</span>
              <span className="text-white/60"> — create a free account</span>
            </span>
            <ArrowRight className="h-4 w-4 text-white/60" />
          </button>
        )}

        <DailyChallenge
          onCompleted={(r) => {
            setStreak(r.streak);
            setPoints(r.points);
            setLevel(Math.max(1, Math.floor(r.points / 100) + 1));
            setCelebrate({ points: r.pointsDelta });
            if (user) {
              recordDailyServer().catch((e) => console.warn(e));
            }
          }}
        />

        {/* ── FACT CARD ───────────────────────────────────── */}
        <section className="flex flex-1 flex-col">

          <AnimatePresence mode="wait">
            <motion.div
              key={fact?.id ?? "loading"}
              initial={{ opacity: 0, y: 24, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -24, scale: 0.98 }}
              transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="relative"
            >
              {/* Category-tinted glow behind card */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] opacity-40 blur-3xl"
                style={{ background: catGradient }}
              />
              <article className="glass-strong relative overflow-hidden rounded-4xl p-5 shadow-[var(--shadow-card)] sm:p-6">
                {/* Speech-bubble tag */}
                <div className="mb-4 flex items-center justify-between">
                  <div className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5">
                    <span aria-hidden>🤔</span>
                    <span className="text-[10px] font-black uppercase tracking-widest text-white/80">
                      Do you know why…
                    </span>
                  </div>
                  <span
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl text-lg shadow-lg"
                    style={{ background: catGradient }}
                    aria-label={fact?.category ?? "category"}
                  >
                    {emojiFor(fact?.category)}
                  </span>
                </div>

                {loading ? (
                  <FactSkeleton />
                ) : error && !fact ? (
                  <p className="text-center text-lg text-rose-300">{error}</p>
                ) : fact ? (
                  <>
                    <h1 className="font-display text-[2rem] font-black leading-[1.05] tracking-tight text-white sm:text-4xl">
                      {capitalize(fact.question)}
                    </h1>

                    <AnimatePresence initial={false} mode="wait">
                      {!revealed ? (
                        <motion.div
                          key="cta"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-6 flex flex-col items-center"
                        >
                          <motion.div
                            initial={{ scale: 0.6, rotate: -8, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 180, damping: 14 }}
                            className="mb-3 flex h-32 w-32 items-center justify-center rounded-full text-6xl shadow-[0_10px_40px_rgba(124,58,237,0.5)] animate-float-slow"
                            style={{ background: catGradient }}
                            aria-label={fact.category ?? "question icon"}
                          >
                            <span>{emojiFor(fact.category)}</span>
                          </motion.div>
                          <button
                            type="button"
                            onClick={reveal}
                            className="animate-pulse-glow group relative w-full overflow-hidden rounded-full px-5 py-4 text-base font-black text-white transition active:scale-[0.98]"
                            style={{ background: "var(--gradient-primary)" }}
                          >
                            <span className="relative z-10 inline-flex items-center gap-2">
                              <Sparkles className="h-5 w-5" />
                              Reveal Answer
                            </span>
                          </button>
                          <p className="mt-3 text-xs text-white/50">Tap to discover the magic ↑</p>
                        </motion.div>
                      ) : (
                        <motion.div
                          key="answer"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="mt-5 space-y-4"
                        >
                          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                              ✨ Answer
                            </p>
                            <p className="mt-2 text-lg leading-relaxed text-white sm:text-xl">
                              {fact.answer}
                            </p>
                          </div>

                          {fact.fun_fact && (
                            <motion.div
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.15 }}
                              className="rounded-3xl border p-4"
                              style={{
                                background: "linear-gradient(135deg, oklch(0.28 0.10 40 / 0.3), oklch(0.30 0.14 340 / 0.3))",
                                borderColor: "oklch(0.72 0.20 40 / 0.35)",
                              }}
                            >
                              <p className="text-[10px] font-black uppercase tracking-widest text-yellow-300">
                                ⭐ Fun fact
                              </p>
                              <p className="mt-1.5 text-sm leading-relaxed text-white/90">
                                {fact.fun_fact}
                              </p>
                            </motion.div>
                          )}

                          {/* Discovery signals */}
                          <div className="grid grid-cols-4 gap-2">
                            <SignalBtn
                              active={reaction === "love"}
                              onClick={() => { setReaction("love"); if (reaction !== "love") grantPoints(1); }}
                              tone="pink"
                              icon={<Heart className={`h-5 w-5 ${reaction === "love" ? "fill-current" : ""}`} />}
                              label="Love"
                            />
                            <SignalBtn
                              active={reaction === "like"}
                              onClick={() => { setReaction("like"); if (reaction !== "like") grantPoints(1); }}
                              tone="amber"
                              icon={<Star className={`h-5 w-5 ${reaction === "like" ? "fill-current" : ""}`} />}
                              label="Rate"
                            />
                            <SignalBtn
                              active={false}
                              onClick={handleShare}
                              tone="cyan"
                              icon={<Share2 className="h-5 w-5" />}
                              label="Share"
                            />
                            <SignalBtn
                              active={fav}
                              onClick={handleFav}
                              tone="violet"
                              icon={fav ? <BookmarkCheck className="h-5 w-5" /> : <BookmarkPlus className="h-5 w-5" />}
                              label={fav ? "Saved" : "Save"}
                            />
                          </div>

                          {/* ── ENDLESS "BUT… WHY?" CHAIN ── */}
                          {(chain.length > 0 || true) && (
                            <div className="pt-2">
                              <p className="mb-3 text-center font-display text-lg font-black text-white">
                                But… <span className="text-gradient">Why?</span> 🤯
                              </p>

                              <ol className="relative space-y-3 pl-9">
                                <span
                                  aria-hidden
                                  className="absolute left-3.5 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-fuchsia-500/60 via-violet-500/40 to-transparent"
                                />
                                <ChainStep index={0} question={capitalize(fact.question)} solved />
                                {chain.map((layer, i) => (
                                  <ChainStep
                                    key={i}
                                    index={i + 1}
                                    question={layer.question}
                                    answer={layer.answer}
                                  />
                                ))}
                                {chainLoading && (
                                  <li className="relative">
                                    <span className="absolute -left-9 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/60">
                                      …
                                    </span>
                                    <p className="text-sm italic text-white/60">Digging deeper…</p>
                                  </li>
                                )}
                              </ol>

                              <button
                                type="button"
                                onClick={askWhy}
                                disabled={chainLoading || chain.length >= 6 || chain[chain.length - 1]?.terminal}
                                className="mt-4 flex w-full items-center justify-center gap-2 rounded-full border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-black text-white transition hover:bg-white/10 active:scale-[0.98] disabled:opacity-50"
                              >
                                {chain.length >= 6
                                  ? "🌌 You've reached the bottom of the rabbit hole"
                                  : chainLoading
                                    ? "Diving deeper…"
                                    : "🤔 But… Why?"}
                              </button>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </>
                ) : (
                  <p className="text-center text-white/70">No facts yet. Tap Next!</p>
                )}

                {error && fact && (
                  <p className="mt-3 text-center text-xs text-amber-300/80">{error}</p>
                )}
              </article>
            </motion.div>
          </AnimatePresence>

          {/* Category bubbles */}
          <div className="-mx-4 mt-5 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <div className="flex gap-2.5 pb-1">
              {CATEGORIES.map((c) => {
                const active = category === c.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    onClick={() => setCategory(c.key)}
                    className="group flex shrink-0 flex-col items-center gap-1"
                  >
                    <span
                      className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-lg transition ${
                        active ? "scale-110 ring-2 ring-white/60" : "opacity-80 group-hover:opacity-100"
                      }`}
                      style={{ background: c.gradient, boxShadow: active ? `0 10px 24px -8px ${c.glow}` : undefined }}
                    >
                      {c.emoji}
                    </span>
                    <span className={`text-[10px] font-bold ${active ? "text-white" : "text-white/60"}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Giant Next button (sticky above bottom nav) */}
        <div className="mt-6 mb-4">
          <motion.button
            type="button"
            disabled={loading}
            onClick={() => loadNext(fact?.id)}
            whileTap={{ scale: 0.97 }}
            className="animate-pulse-glow relative w-full overflow-hidden rounded-full px-6 py-5 text-xl font-black uppercase tracking-wide text-white disabled:opacity-70"
            style={{ background: "var(--gradient-primary)" }}
          >
            <span className="relative z-10 inline-flex items-center justify-center gap-3">
              {loading ? "Loading…" : "Next"}
              <ArrowRight className="h-6 w-6" />
            </span>
            <span
              aria-hidden
              className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/20"
              style={{ animation: "shimmer 2.4s ease-in-out infinite" }}
            />
          </motion.button>
        </div>
      </div>

      <BottomNav />
      <Celebration
        open={!!celebrate}
        points={celebrate?.points ?? 0}
        streak={streak}
        onClose={() => setCelebrate(null)}
      />
      <SignInPrompt
        open={!!signInPrompt}
        onClose={() => setSignInPrompt(null)}
        title={signInPrompt?.title}
        message={signInPrompt?.message}
      />
    </main>
  );
}

// ── UI atoms ──────────────────────────────────────────────

function SignalBtn({
  active, onClick, icon, label, tone,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  tone: "pink" | "amber" | "cyan" | "violet";
}) {
  const tones: Record<string, { bg: string; ring: string; text: string }> = {
    pink:   { bg: "oklch(0.30 0.16 340 / 0.25)", ring: "oklch(0.72 0.24 340)", text: "text-pink-300" },
    amber:  { bg: "oklch(0.30 0.14 60 / 0.25)",  ring: "oklch(0.80 0.18 80)",  text: "text-yellow-300" },
    cyan:   { bg: "oklch(0.30 0.14 200 / 0.25)", ring: "oklch(0.72 0.20 200)", text: "text-cyan-300" },
    violet: { bg: "oklch(0.30 0.14 300 / 0.25)", ring: "oklch(0.72 0.22 305)", text: "text-violet-300" },
  };
  const t = tones[tone];
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={{ scale: 0.9 }}
      className={`flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[10px] font-black uppercase tracking-wide transition ${
        active ? `${t.text}` : "text-white/70"
      }`}
      style={{
        background: active ? t.bg : "oklch(1 0 0 / 0.05)",
        border: `1px solid ${active ? t.ring : "oklch(1 0 0 / 0.1)"}`,
      }}
    >
      {icon}
      <span>{label}</span>
    </motion.button>
  );
}

function ChainStep({
  index, question, answer, solved,
}: {
  index: number;
  question: string;
  answer?: string;
  solved?: boolean;
}) {
  return (
    <motion.li
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className="relative"
    >
      <span
        className="absolute -left-9 top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white shadow-lg"
        style={{
          background: solved ? "linear-gradient(135deg, oklch(0.72 0.18 155), oklch(0.72 0.22 195))" : "var(--gradient-primary)",
        }}
      >
        {solved ? "✓" : index}
      </span>
      <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
        <p className="text-sm font-bold leading-snug text-white">{question}</p>
        {answer && (
          <p className="mt-1.5 text-xs leading-relaxed text-white/70">{answer}</p>
        )}
      </div>
    </motion.li>
  );
}

function FactSkeleton() {
  return (
    <div className="space-y-3 py-4">
      <div className="h-8 w-3/4 animate-pulse rounded-xl bg-white/10" />
      <div className="h-8 w-1/2 animate-pulse rounded-xl bg-white/10" />
      <div className="mt-6 h-14 animate-pulse rounded-full bg-white/10" />
    </div>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
