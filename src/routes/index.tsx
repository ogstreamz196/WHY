import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

function notifyAchievements(ids?: string[]) {
  if (!ids?.length) return;
  for (const id of ids) {
    toast.success(`🏆 Achievement unlocked: ${id.replace(/_/g, " ")}`);
  }
}

const REVEAL_KEYWORDS: Array<{ match: RegExp; label: string; emoji: string }> = [
  { match: /\b(thorn|spike|cactus|rose|prickl)/i, label: "Reveal the Spiky Secret", emoji: "🌵" },
  { match: /\b(plant|flower|tree|leaf|forest|garden|seed)/i, label: "Grow the Answer", emoji: "🌱" },
  { match: /\b(build|construct|bridge|tower|architect|crane|cement|brick)/i, label: "Build Me a Fact", emoji: "🏗️" },
  { match: /\b(space|planet|star|galaxy|moon|rocket|astronaut|orbit)/i, label: "Launch the Answer", emoji: "🚀" },
  { match: /\b(ocean|sea|fish|shark|whale|water|river|wave|underwater)/i, label: "Dive Into the Answer", emoji: "🌊" },
  { match: /\b(fire|volcano|lava|flame|burn)/i, label: "Ignite the Answer", emoji: "🔥" },
  { match: /\b(ice|snow|cold|frozen|glacier|arctic)/i, label: "Chill Out the Answer", emoji: "❄️" },
  { match: /\b(dog|cat|animal|bird|lion|tiger|elephant|monkey|pet)/i, label: "Unleash the Answer", emoji: "🐾" },
  { match: /\b(dinosaur|fossil|prehistoric|jurassic)/i, label: "Dig Up the Answer", emoji: "🦖" },
  { match: /\b(food|eat|cook|recipe|pizza|bread|fruit|vegetable)/i, label: "Taste the Answer", emoji: "🍽️" },
  { match: /\b(candy|sweet|sugar|chocolate|cake|dessert)/i, label: "Reveal the Sweet Answer", emoji: "🍬" },
  { match: /\b(music|song|sound|instrument|guitar|piano)/i, label: "Play the Answer", emoji: "🎵" },
  { match: /\b(sport|game|play|ball|team|race)/i, label: "Score the Answer", emoji: "⚽" },
  { match: /\b(car|train|plane|vehicle|engine|road)/i, label: "Drive to the Answer", emoji: "🚗" },
  { match: /\b(money|coin|dollar|economy|bank)/i, label: "Cash In the Answer", emoji: "💰" },
  { match: /\b(brain|mind|think|memory|dream|sleep)/i, label: "Unlock the Answer", emoji: "🧠" },
  { match: /\b(body|heart|blood|bone|muscle|health)/i, label: "Reveal the Heartbeat", emoji: "❤️" },
  { match: /\b(book|read|story|word|language|write)/i, label: "Turn the Page", emoji: "📖" },
  { match: /\b(computer|robot|tech|code|internet|phone|app)/i, label: "Boot Up the Answer", emoji: "🤖" },
  { match: /\b(history|ancient|king|queen|war|empire)/i, label: "Unearth the Answer", emoji: "🏛️" },
  { match: /\b(magic|wizard|dragon|myth|legend)/i, label: "Cast the Answer", emoji: "✨" },
  { match: /\b(weather|rain|storm|cloud|wind|sun)/i, label: "Clear the Skies", emoji: "🌤️" },
];

const CATEGORY_REVEAL: Record<string, { label: string; emoji: string }> = {
  science: { label: "Run the Experiment", emoji: "🧪" },
  nature: { label: "Grow the Answer", emoji: "🌿" },
  space: { label: "Launch the Answer", emoji: "🚀" },
  history: { label: "Unearth the Answer", emoji: "🏛️" },
  tech: { label: "Boot Up the Answer", emoji: "🤖" },
  animals: { label: "Unleash the Answer", emoji: "🐾" },
  food: { label: "Taste the Answer", emoji: "🍽️" },
  sports: { label: "Score the Answer", emoji: "⚽" },
  music: { label: "Play the Answer", emoji: "🎵" },
  art: { label: "Paint the Answer", emoji: "🎨" },
  geography: { label: "Chart the Answer", emoji: "🗺️" },
  psychology: { label: "Read My Mind", emoji: "🧠" },
};

function getRevealLabel(question?: string, category?: string | null): { label: string; emoji: string } {
  if (question) {
    for (const k of REVEAL_KEYWORDS) if (k.match.test(question)) return { label: k.label, emoji: k.emoji };
  }
  if (category && CATEGORY_REVEAL[category]) return CATEGORY_REVEAL[category];
  return { label: "Reveal the Answer", emoji: "✨" };
}


import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  BookmarkPlus,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
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
  getSeen,
  getSeenIds,
  markSeen,
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
import { GuestSignUpPopup } from "@/components/GuestSignUpPopup";
import { getGuestPromptSeconds } from "@/lib/boss.functions";
import { useQuery } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/auth";
import { useThrottledFlag } from "@/lib/useThrottledFlag";
import { levelFor } from "@/lib/levels";
import { DailyMission } from "@/components/DailyMission";
import { asWhyQuestion } from "@/lib/whyQuestion";
import { TalkingWords } from "@/components/TalkingWords";
import { LevelUpCelebration } from "@/components/LevelUpCelebration";
import { markMissionTask, type MissionTask } from "@/lib/missions.functions";
import {
  getMyProfile,
  getMyStats,
  migrateGuestData,
  recordDiscovery,
  recordDailyChallenge,
  claimDailyLoginBonus,
  toggleFavorite as toggleFavoriteServer,
  updateMyProfile,
} from "@/lib/account.functions";
import {
  resumeLastChain,
  saveChain,
  bumpCategoryInterest,
  type ChainSummary,
} from "@/lib/chains.functions";


import mascotImg from "@/assets/mascot.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Why? — A pocket-sized universe of curiosity" },
      { name: "description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
      { property: "og:title", content: "Why? — A pocket-sized universe of curiosity" },
      { property: "og:description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
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
  const fetchLastChain = useServerFn(resumeLastChain);
  const saveChainServer = useServerFn(saveChain);
  const bumpInterest = useServerFn(bumpCategoryInterest);
  const claimBonus = useServerFn(claimDailyLoginBonus);
  const updateProfile = useServerFn(updateMyProfile);

  const { user, isGuest } = useCurrentUser();
  const navigate = useNavigate();

  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const showSkeleton = useThrottledFlag(loading, 180);
  const [revealed, setRevealed] = useState(false);
  const [revealing, setRevealing] = useState(false);
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
  const [lastChain, setLastChain] = useState<ChainSummary | null>(null);
  const [savingChain, setSavingChain] = useState(false);
  const [savedChainId, setSavedChainId] = useState<string | null>(null);
  const [bonusAvailable, setBonusAvailable] = useState(false);
  const [bonusClaiming, setBonusClaiming] = useState(false);
  const [welcome, setWelcome] = useState(false);
  const [levelUp, setLevelUp] = useState<null | { level: number; title: string }>(null);
  const missionMarkerRef = useRef<null | ((t: MissionTask) => void)>(null);
  const markMissionServer = useServerFn(markMissionTask);
  const markMission = useCallback((t: MissionTask) => {
    if (missionMarkerRef.current) missionMarkerRef.current(t);
    else if (user) markMissionServer({ data: { task: t } }).catch(() => {});
  }, [markMissionServer, user]);

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
        const welcomedKey = `why:welcomed:${user.id}`;
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
        if (typeof window !== "undefined" && !localStorage.getItem(welcomedKey)) {
          setWelcome(true);
          localStorage.setItem(welcomedKey, "1");
        }
        const [profile, stats, last] = await Promise.all([
          fetchProfile(),
          fetchStats(),
          fetchLastChain().catch(() => null),
        ]);
        if (cancelled) return;
        setDisplayName(profile?.display_name ?? user.email?.split("@")[0] ?? null);
        setPoints(stats.total_points);
        setStreak(stats.current_streak);
        setLevel(Math.max(1, Math.floor(stats.total_points / 100) + 1));
        setLastChain(last);
        const todayStr = new Date().toISOString().slice(0, 10);
        setBonusAvailable(stats.last_login_bonus_day !== todayStr);
      } catch (e) {
        console.warn("account load failed", e);
      }
    })();
    return () => { cancelled = true; };
  }, [user, migrateGuest, fetchProfile, fetchStats, fetchLastChain]);


  const grantPoints = useCallback((delta: number) => {
    const prev = getPoints();
    const next = addPoints(delta);
    setPoints(next);
    const prevInfo = levelFor(prev);
    const nextInfo = levelFor(next);
    setLevel(nextInfo.level);
    if (nextInfo.level > prevInfo.level) {
      setLevelUp({ level: nextInfo.level, title: nextInfo.title });
      return;
    }
    // Milestones: every 50 pts (but not more than once per crossing)
    const crossed = Math.floor(next / 50) > Math.floor(prev / 50);
    if (crossed && next - lastMilestone.current >= 50) {
      lastMilestone.current = next;
      setCelebrate({ points: 50 });
    }
  }, []);

  const handleClaimBonus = useCallback(async () => {
    if (bonusClaiming || !bonusAvailable) return;
    setBonusClaiming(true);
    try {
      const res = await claimBonus();
      if (res.claimed) {
        setPoints(res.stats.total_points);
        setStreak(res.stats.current_streak);
        setLevel(Math.max(1, Math.floor(res.stats.total_points / 100) + 1));
        setCelebrate({ points: res.awarded_points });
      }
      setBonusAvailable(false);
    } catch (e) {
      console.warn("bonus claim failed", e);
    } finally {
      setBonusClaiming(false);
    }
  }, [bonusAvailable, bonusClaiming, claimBonus]);

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
        const seen = getSeenIds();

        let next: Fact | null = null;

        // Always prefer an unseen fact from the DB. Only when the pool is
        // exhausted (or the user explicitly asked) do we generate a new one.
        if (!opts?.forceGenerate) {
          next = await getRandom({ data: { excludeId: currentId, category: cat, seenIds: seen } });
        }
        if (!next || opts?.forceGenerate) {
          try {
            next = await generateNew({
              data: { category: cat, seenIds: seen, force: opts?.forceGenerate },
            });
          } catch (e) { console.warn(e); }
          if (next) { tapCount.current = 0; nextGenAt.current = 4 + Math.floor(Math.random() * 7); }
        }
        if (!next) {
          const cached = getCachedRandomFact(currentId);
          if (cached) next = cached;
        }
        showFact(next);
        if (next?.id) markSeen(next.id);
        bumpSeen();
        // Coin + discovery credit is deferred to a 4s dwell timer (see effect
        // below) so users can't farm by mashing "But… Why?".
      } catch (err) {
        console.error(err);
        const cached = getCachedRandomFact(currentId);
        if (cached) { showFact(cached); setError("You're offline — showing a cached fact."); }
        else setError("Couldn't load a fact. Try again.");
      } finally {
        setLoading(false);
      }
    },
    [category, generateNew, getRandom, showFact],
  );

  // Dwell reward: only award the coin (and record the discovery server-side)
  // after the user stays on the fact for ≥4 seconds. Switching facts or
  // unmounting before then cancels the reward.
  useEffect(() => {
    const id = fact?.id;
    if (!id) return;
    const t = window.setTimeout(() => {
      grantPoints(1);
      if (user) {
        recordDiscoveryServer({ data: { fact_id: id } })
          .then((r) => notifyAchievements(r?.newlyUnlocked))
          .catch((e) => console.warn(e));
      }
    }, 4000);
    return () => window.clearTimeout(t);
  }, [fact?.id, user, grantPoints, recordDiscoveryServer]);

  useEffect(() => { void loadNext(); /* eslint-disable-line */ }, []);
  useEffect(() => {
    void loadNext(fact?.id); /* eslint-disable-line */
    if (user && category !== "all") {
      bumpInterest({ data: { category, delta: 1 } }).catch(() => {});
    }
  }, [category]);

  // Bump interest for a fact's own category when we discover it (signed-in only)
  useEffect(() => {
    if (!user || !fact?.category) return;
    bumpInterest({ data: { category: fact.category, delta: 1 } }).catch(() => {});
  }, [fact?.id, fact?.category, user, bumpInterest]);

  const reveal = () => {
    if (revealed || revealing) return;
    setRevealing(true);
    // Short morph/pulse before showing the answer
    window.setTimeout(() => {
      setRevealed(true);
      setRevealing(false);
      grantPoints(2);
      markMission("mystery");
      markMission("surprise");
      if (category !== "all" && fact?.category) markMission("category");
    }, 480);
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
        setChain((c) => {
          const next = [...c, layer];
          if (next.length >= 3) markMission("chain");
          return next;
        });
        setSavedChainId(null); // dirty
        grantPoints(3);
      }
    } catch (e) { console.warn(e); }
    finally { setChainLoading(false); }
  };

  const handleSaveChain = async () => {
    if (!fact || chain.length === 0) return;
    if (isGuest) {
      setSignInPrompt({
        title: "Save this trail",
        message: "Sign up to keep your Why chains, share them, and pick up where you left off.",
      });
      return;
    }
    setSavingChain(true);
    try {
      const steps = [
        { question: fact.question, answer: fact.answer },
        ...chain.map((c) => ({ question: c.question, answer: c.answer ?? null })),
      ];
      const res = await saveChainServer({
        data: {
          title: fact.question.slice(0, 100),
          root_fact_id: fact.id,
          steps,
        },
      });
      setSavedChainId(res.id);
      grantPoints(5);
    } catch (e) {
      console.warn(e);
    } finally {
      setSavingChain(false);
    }
  };

  const handleShare = async () => {
    if (!fact) return;
    const url = typeof window !== "undefined" ? window.location.origin : "https://why.app";
    const text = `🤔 WHY?\n\n${asWhyQuestion(fact.question)}\n\nTap to discover.\n${url}`;
    try {
      if (navigator.share) await navigator.share({ title: "Why?", text, url });
      else { await navigator.clipboard.writeText(text); alert("Copied to clipboard!"); }
    } catch { /* cancelled */ }
  };

  const handleFav = () => {
    if (!fact) return;
    const now = toggleFavorite(fact);
    setFav(now);
    if (now) grantPoints(1);
    if (user) {
      toggleFavServer({ data: { fact_id: fact.id } }).catch((e) => console.warn(e));
    } else if (now) {
      const nudgeKey = "why:favNudgeCount";
      const count = Number(sessionStorage.getItem(nudgeKey) ?? "0") + 1;
      sessionStorage.setItem(nudgeKey, String(count));
      toast.success("Saved on this device", {
        description: count % 3 === 1 ? "Sign up to keep favourites across every device." : undefined,
        action: count % 3 === 1
          ? { label: "Sign up", onClick: () => navigate({ to: "/auth", search: { mode: "signup", redirect: "/" } }) }
          : undefined,
      });
    }
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

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-2xl flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:max-w-3xl lg:max-w-4xl lg:px-8">
        {/* ── GAMIFIED HEADER ─────────────────────────────── */}
        <header className="mb-3 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={() => setSearchOpen((v) => !v)}
              aria-label="Search"
              className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-foreground/90 transition active:scale-95"
            >
              {searchOpen ? <X className="h-5 w-5" /> : <SearchIcon className="h-5 w-5" />}
            </button>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-1.5">
              <div className="glass flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5">
                <Flame className="h-4 w-4 text-orange-400" />
                <span className="text-sm font-black text-white">{streak}</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-white/60">day</span>
              </div>
              <Link
                to={user ? "/profile" : "/auth"}
                aria-label={user ? "Open profile" : "Sign in"}
                className="glass flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl overflow-hidden active:scale-95 transition"
              >
                {user ? (
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl text-lg" style={{ background: "var(--gradient-primary)" }}>
                    <span className="font-black text-white">{(displayName ?? user.email ?? "?").slice(0, 1).toUpperCase()}</span>
                  </span>
                ) : (
                  <img src={mascotImg} alt="" loading="lazy" decoding="async" className="h-10 w-10 object-contain animate-float-slow" />
                )}
              </Link>
              <div className="glass flex shrink-0 items-center gap-1.5 rounded-2xl px-3 py-1.5">
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
          <GuestProgressCard
            discoveries={getSeen()}
            streak={streak}
            points={points}
            onSignUp={() => setSignInPrompt({ title: "Save your curiosity", message: "Create a free account to keep your streak, coins, favourites and daily rewards forever." })}
          />
        )}

        {/* Daily login bonus */}
        {user && bonusAvailable && (
          <motion.button
            type="button"
            onClick={handleClaimBonus}
            disabled={bonusClaiming}
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="mb-3 flex w-full items-center justify-between gap-3 rounded-2xl border border-amber-300/30 bg-gradient-to-r from-amber-500/20 via-orange-500/15 to-pink-500/15 px-4 py-3 text-left shadow-[0_0_24px_rgba(251,191,36,0.15)] transition disabled:opacity-60"
          >
            <span className="flex items-center gap-3">
              <motion.span
                animate={{ rotate: [0, -8, 8, -4, 4, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2 }}
                className="text-2xl"
              >
                🎁
              </motion.span>
              <span>
                <span className="block text-sm font-black text-white">Daily login bonus</span>
                <span className="block text-xs text-white/70">Tap to claim today's curiosity reward</span>
              </span>
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-black text-amber-200">
              <CoinIcon className="h-3.5 w-3.5" />
              claim
            </span>
          </motion.button>
        )}

        {/* Continue last Why chain */}
        {user && lastChain && lastChain.step_count > 1 && (
          <Link
            to="/chain/$id"
            params={{ id: lastChain.id }}
            className="mb-3 flex items-center gap-3 rounded-2xl border border-fuchsia-400/25 bg-gradient-to-r from-fuchsia-500/15 to-violet-500/15 px-4 py-3"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-lg" style={{ background: "var(--gradient-primary)" }}>
              🧵
            </span>
            <div className="flex-1 min-w-0">
              <div className="text-[10px] font-black uppercase tracking-widest text-fuchsia-200/80">Continue your chain</div>
              <div className="truncate text-sm font-bold text-white">
                {lastChain.title ?? lastChain.last_question ?? "Pick up where you left off"}
              </div>
              <div className="text-[10px] text-white/50">{lastChain.step_count} steps deep</div>
            </div>
            <ArrowRight className="h-4 w-4 text-white/60" />
          </Link>
        )}

        <DailyMission
          onOpenCategory={(k) => setCategory(k as CategoryKey)}
          onCelebrate={(pts) => setCelebrate({ points: pts })}
          registerMarker={(fn) => { missionMarkerRef.current = fn; }}
        />












        <DailyChallenge
          onCompleted={(r) => {
            setStreak(r.streak);
            setPoints(r.points);
            setLevel(Math.max(1, Math.floor(r.points / 100) + 1));
            setCelebrate({ points: r.pointsDelta });
            if (user) {
              recordDailyServer()
                .then((r) => notifyAchievements(r?.newlyUnlocked))
                .catch((e) => console.warn(e));
            }
          }}
        />

        {/* ── FACT CARD ───────────────────────────────────── */}
        <section className="flex flex-1 flex-col">

          <AnimatePresence mode="wait">
            <motion.div
              key={fact?.id ?? "loading"}
              initial={{ opacity: 0, y: 20, x: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
              exit={{ opacity: 0, y: -14, x: -16, scale: 0.97 }}
              transition={{ duration: 0.36, ease: [0.32, 0.72, 0, 1] }}
              className="relative"
            >
              {/* Category-tinted glow behind card */}
              <div
                aria-hidden
                className="pointer-events-none absolute -inset-6 -z-10 rounded-[3rem] opacity-40 blur-3xl"
                style={{ background: catGradient }}
              />
              <div className="candy-rainbow-border">
              <article className="glass-strong relative overflow-hidden p-5 shadow-[var(--shadow-card)] sm:p-6 md:p-8 lg:p-10">
                {/* Candy sprinkles falling behind content */}
                <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                  {[
                    { left: "8%",  delay: "0s",   color: "#ff5fa2" },
                    { left: "22%", delay: "1.1s", color: "#ffd93d" },
                    { left: "38%", delay: "2.3s", color: "#6bd968" },
                    { left: "55%", delay: "0.6s", color: "#4ea8ff" },
                    { left: "71%", delay: "1.8s", color: "#c471ff" },
                    { left: "88%", delay: "2.9s", color: "#ff9a3c" },
                  ].map((s, i) => (
                    <span
                      key={i}
                      className="candy-sprinkle"
                      style={{ left: s.left, background: s.color, animationDelay: s.delay, transform: `rotate(${i * 40}deg)` }}
                    />
                  ))}
                </div>
                {/* Speech-bubble tag */}
                <div className="relative mb-4 flex flex-wrap items-center gap-3 sm:mb-5">
                  <div className="candy-chip animate-fade-up inline-flex min-w-0 max-w-full items-center gap-2 rounded-full px-3 py-2 sm:px-4 sm:py-2.5">
                    <span aria-hidden className="shrink-0 text-lg">🍭</span>
                    <span className="truncate text-sm font-black uppercase tracking-widest sm:text-base md:text-lg">
                      Curious?
                    </span>
                  </div>
                  <span
                    className="animate-bounce-in ml-auto inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-xl shadow-lg sm:h-11 sm:w-11 md:h-12 md:w-12 md:text-2xl"
                    style={{ background: catGradient }}
                    aria-label={fact?.category ?? "category"}
                  >
                    {emojiFor(fact?.category)}
                  </span>
                </div>




                <AnimatePresence mode="wait" initial={false}>
                {showSkeleton ? (
                  <motion.div
                    key="skeleton"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                  >
                    <FactSkeleton />
                  </motion.div>
                ) : error && !fact ? (
                  <motion.p
                    key="err"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center text-lg text-rose-300"
                  >
                    {error}
                  </motion.p>
                ) : fact ? (
                  <motion.div
                    key={`fact-${fact.id}`}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                  >
                    <h1 className="animate-fade-up stagger-1 font-fun font-bold leading-[1.05] tracking-tight text-white text-[clamp(2rem,7vw,4rem)] [text-wrap:balance] break-words hyphens-auto">
                      {asWhyQuestion(fact.question)}
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
                            initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
                            animate={{ scale: 1, rotate: 0, opacity: 1 }}
                            transition={{ type: "spring", stiffness: 200, damping: 12 }}
                            whileHover={{ scale: 1.08, rotate: 6 }}
                            whileTap={{ scale: 0.92, rotate: -6 }}
                            className="candy-emoji-orb mb-4 flex h-32 w-32 items-center justify-center rounded-full text-6xl cursor-grab active:cursor-grabbing"
                            aria-label={fact.category ?? "question icon"}
                          >
                            <span>{emojiFor(fact.category)}</span>
                          </motion.div>
                          <motion.button
                            type="button"
                            onClick={reveal}
                            disabled={revealing}
                            layout
                            whileHover={{ scale: 1.03, rotate: -1 }}
                            whileTap={{ scale: 0.94 }}
                            animate={
                              revealing
                                ? { scale: [1, 1.06, 0.88, 1.02], rotate: [0, -2, 2, 0] }
                                : { scale: 1 }
                            }
                            transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
                            className="candy-btn group relative w-full overflow-hidden rounded-full px-5 py-4 text-lg font-black uppercase tracking-wide text-white"
                          >
                            <span aria-hidden className="shine-sweep" />
                            {revealing && (
                              <motion.span
                                aria-hidden
                                initial={{ x: "-100%" }}
                                animate={{ x: "0%" }}
                                transition={{ duration: 0.46, ease: "easeOut" }}
                                className="absolute inset-0 bg-white/30"
                              />
                            )}
                            <span className="relative z-10 inline-flex items-center gap-2">
                              <motion.span
                                animate={
                                  revealing
                                    ? { rotate: 720, scale: 1.5 }
                                    : { rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }
                                }
                                transition={
                                  revealing
                                    ? { duration: 0.5, ease: "easeOut" }
                                    : { duration: 2.2, repeat: Infinity, ease: "easeInOut" }
                                }
                                className="inline-flex"
                              >
                                <Sparkles className="h-5 w-5" />
                              </motion.span>
                              {(() => {
                                const rv = getRevealLabel(fact.question, fact.category);
                                return <>
                                  {revealing ? "Unwrapping…" : rv.label}
                                  <span aria-hidden className="text-xl">{rv.emoji}</span>
                                </>;
                              })()}
                            </span>


                          </motion.button>
                          <p className="mt-3 text-xs font-bold text-white/70">
                            <span aria-hidden>🎉</span> Tap the candy button — go on! <span aria-hidden>🎉</span>
                          </p>

                        </motion.div>
                      ) : (
                        <motion.div
                          key="answer"
                          initial={{ opacity: 0, y: 12 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="mt-5 space-y-4"
                        >
                          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] p-5">
                            <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                              ✨ Answer
                            </p>
                            <p className="mt-2 font-fun font-medium leading-snug text-white text-[clamp(1.35rem,3.6vw,1.9rem)]">
                              <TalkingWords text={fact.answer} />
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
                              <p className="mt-1.5 font-fun font-medium leading-snug text-white/95 text-[clamp(1.1rem,2.8vw,1.4rem)]">
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

                              <ol className="relative space-y-3 pl-9">
                                <span
                                  aria-hidden
                                  className="absolute left-3.5 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-fuchsia-500/60 via-violet-500/40 to-transparent"
                                />
                                <ChainStep index={0} question={asWhyQuestion(fact.question)} solved />
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

                              <motion.button
                                type="button"
                                onClick={askWhy}
                                disabled={chainLoading || chain.length >= 6 || chain[chain.length - 1]?.terminal}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.96 }}
                                className="candy-btn font-fun mt-4 flex min-h-16 w-full items-center justify-center gap-3 rounded-full px-6 py-3 text-[clamp(1.15rem,3vw,1.5rem)] font-bold uppercase tracking-wide text-white disabled:opacity-50"
                              >
                                {chain.length >= 6
                                  ? "🌌 You've reached the bottom of the rabbit hole"
                                  : chainLoading
                                    ? "Diving deeper…"
                                    : <><span aria-hidden>🤔</span> But… Why?</>}
                              </motion.button>

                              {chain.length > 0 && (
                                <button
                                  type="button"
                                  onClick={handleSaveChain}
                                  disabled={savingChain || !!savedChainId}
                                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-500/10 px-5 py-3 text-xs font-black text-fuchsia-100 transition hover:bg-fuchsia-500/20 disabled:opacity-60"
                                >
                                  {savedChainId ? "✓ Saved to your chains" : savingChain ? "Saving…" : "🧵 Save this chain"}
                                </button>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                ) : (
                  <motion.p
                    key="empty"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-center text-white/70"
                  >
                    No facts yet. Tap Next!
                  </motion.p>
                )}
                </AnimatePresence>

                {error && fact && (
                  <p className="mt-3 text-center text-xs text-amber-300/80">{error}</p>
                )}
              </article>
              </div>

            </motion.div>
          </AnimatePresence>

          {/* Category bubbles */}
          <CategoryScroller
            categories={CATEGORIES}
            activeKey={category}
            onSelect={setCategory}
          />

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
              {loading ? "Loading…" : "NEW FACT"}
              <ArrowRight className="h-6 w-6" />
            </span>
            <span
              aria-hidden
              className="absolute inset-y-0 -left-1/3 w-1/3 skew-x-12 bg-white/20"
              style={{ animation: "shimmer 2.4s ease-in-out infinite" }}
            />
          </motion.button>
        </div>

        {user && (
          <section aria-labelledby="curiosity-challenge-title">
            <h2 id="curiosity-challenge-title" className="sr-only">Curiosity Challenge</h2>
            <Link
              to="/quiz"
              aria-label="Curiosity Challenge — take a quiz and climb the leaderboard"
              className="mt-2 mb-4 flex items-center gap-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-500/15 via-fuchsia-500/15 to-violet-500/15 p-4 shadow-[0_0_24px_rgba(236,72,153,0.15)] transition active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/80"
            >
              <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xl shadow" style={{ background: "var(--gradient-primary)" }}>
                🏆
              </span>
              <div className="min-w-0 flex-1">
                <div className="text-[10px] font-black uppercase tracking-widest text-amber-200/80">Curiosity Challenge</div>
                <div className="truncate text-sm font-bold text-white">Take a quiz · climb the leaderboard</div>
                <div className="text-[10px] text-white/50">Correct +10 · Fast bonus · Perfect ×1.5</div>
              </div>
              <ArrowRight aria-hidden className="h-4 w-4 text-white/60" />
            </Link>
          </section>
        )}


      </div>


      {showSkeleton && !fact ? <BottomNavSkeleton /> : <BottomNav />}
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
      <WelcomeOverlay
        open={welcome}
        name={displayName}
        needsName={!displayName || displayName === user?.email?.split("@")[0]}
        onClose={() => setWelcome(false)}
        onSubmitName={async (nickname) => {
          try {
            const updated = await updateProfile({ data: { display_name: nickname } });
            setDisplayName(updated.display_name ?? nickname);
          } catch (e) {
            console.warn("nickname save failed", e);
            throw e;
          }
        }}
      />
      <LevelUpCelebration
        open={!!levelUp}
        level={levelUp?.level ?? 1}
        title={levelUp?.title ?? ""}
        onClose={() => setLevelUp(null)}
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
        <p className="font-fun font-semibold text-white text-[clamp(1.05rem,2.6vw,1.3rem)]">{question}</p>
        {answer && (
          <p className="mt-1.5 font-fun text-white/85 text-[clamp(0.95rem,2.3vw,1.15rem)]">{answer}</p>
        )}
      </div>
    </motion.li>
  );
}

function ShimmerBar({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/[0.06] ${className}`}>
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent"
        animate={{ x: ["0%", "300%"] }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      />
    </div>
  );
}

function FactSkeleton() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading next fact"
      className="space-y-3 py-4"
    >
      <div className="mb-4 flex items-center gap-3">
        <ShimmerBar className="h-9 w-9 rounded-2xl" />
        <ShimmerBar className="h-4 w-32" />
      </div>
      <ShimmerBar className="h-8 w-11/12" />
      <ShimmerBar className="h-8 w-3/4" />
      <ShimmerBar className="h-8 w-1/2" />
      <div className="mt-6 flex flex-col items-center gap-3">
        <ShimmerBar className="h-24 w-24 rounded-full" />
        <ShimmerBar className="h-14 w-full rounded-full" />
      </div>
    </div>
  );
}

function BottomNavSkeleton() {
  return (
    <nav
      aria-label="Loading navigation"
      aria-busy="true"
      className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-2xl px-3 pb-3">
        <div className="glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-[var(--shadow-card)]">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1 px-2 py-1.5">
              <ShimmerBar className="h-5 w-5 rounded-md" />
              <ShimmerBar className="h-2 w-8" />
            </div>
          ))}
        </div>
      </div>
    </nav>
  );
}


function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Ensure the fact question reads as a full "Why…?" question.
// Prepends "Why" (if missing) and appends a "?" (if missing).
export { asWhyQuestion } from "@/lib/whyQuestion";



function GuestProgressCard({
  discoveries,
  streak,
  points,
  onSignUp,
}: {
  discoveries: number;
  streak: number;
  points: number;
  onSignUp: () => void;
}) {
  const nextMilestone = discoveries < 10 ? 10 : discoveries < 25 ? 25 : discoveries < 50 ? 50 : 100;
  const pct = Math.min(100, Math.round((discoveries / nextMilestone) * 100));
  const rewards = [
    { icon: "🔥", label: "Daily streak", locked: streak < 2 },
    { icon: "🎁", label: "Login bonus", locked: true },
    { icon: "⭐", label: "Achievements", locked: true },
    { icon: "☁️", label: "Cloud sync", locked: true },
  ];
  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 overflow-hidden rounded-3xl border border-violet-400/20 bg-gradient-to-br from-violet-500/15 via-fuchsia-500/10 to-indigo-500/15 p-4 shadow-[0_0_28px_rgba(139,92,246,0.15)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-lg">🧭</span>
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-white">
              Guest explorer
            </h3>
          </div>
          <p className="mt-1 text-xs text-white/60">
            You've discovered{" "}
            <span className="font-black text-white">{discoveries}</span>{" "}
            {discoveries === 1 ? "fact" : "facts"} — {nextMilestone - discoveries > 0 ? `${nextMilestone - discoveries} more to your next milestone.` : "milestone unlocked!"}
          </p>
        </div>
        <button
          type="button"
          onClick={onSignUp}
          className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-widest text-violet-700 shadow-md transition hover:scale-105"
        >
          Unlock
        </button>
      </div>

      <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="h-full rounded-full bg-gradient-to-r from-violet-400 via-fuchsia-400 to-amber-300"
        />
      </div>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        {rewards.map((r) => (
          <button
            key={r.label}
            type="button"
            onClick={onSignUp}
            className={`group flex flex-col items-center gap-1 rounded-2xl border p-2 text-center transition ${
              r.locked
                ? "border-white/5 bg-white/[0.03] hover:border-violet-400/30 hover:bg-white/[0.06]"
                : "border-emerald-400/30 bg-emerald-500/10"
            }`}
          >
            <span className={`text-lg ${r.locked ? "opacity-60 group-hover:opacity-100" : ""}`}>
              {r.locked ? "🔒" : r.icon}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-white/60">
              {r.label}
            </span>
          </button>
        ))}
      </div>

      {(streak > 0 || points > 0) && (
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/60">
          <span>Local progress:</span>
          {streak > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 font-black text-orange-200">🔥 {streak}d</span>}
          {points > 0 && <span className="rounded-full bg-white/10 px-2 py-0.5 font-black text-amber-200">✨ {points} XP</span>}
          <span className="ml-auto text-white/40">saved on this device</span>
        </div>
      )}
    </motion.div>
  );
}

export function WelcomeOverlay({
  open,
  name,
  needsName,
  onClose,
  onSubmitName,
}: {
  open: boolean;
  name: string | null;
  needsName?: boolean;
  onClose: () => void;
  onSubmitName?: (nickname: string) => Promise<void>;
}) {
  const [nickname, setNickname] = useState(name ?? "");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setNickname(name ?? "");
      setErr(null);
    }
  }, [open, name]);

  const handleBegin = async () => {
    if (!needsName || !onSubmitName) { onClose(); return; }
    const trimmed = nickname.trim();
    if (trimmed.length < 1 || trimmed.length > 60) {
      setErr("Nickname must be 1–60 characters.");
      return;
    }
    setSaving(true);
    setErr(null);
    try {
      await onSubmitName(trimmed);
      onClose();
    } catch {
      setErr("Couldn't save nickname. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 220, damping: 18 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-4xl border border-white/15 bg-gradient-to-br from-indigo-900/90 via-violet-900/90 to-fuchsia-900/90 p-6 text-center shadow-[0_0_60px_rgba(139,92,246,0.4)]"
          >
            <div className="pointer-events-none absolute inset-0 opacity-40">
              {Array.from({ length: 14 }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: 0, x: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    y: [0, -60 - Math.random() * 40],
                    x: [(Math.random() - 0.5) * 40, (Math.random() - 0.5) * 120],
                    scale: [0, 1, 0.5],
                  }}
                  transition={{ duration: 2.4, delay: i * 0.08, repeat: Infinity, repeatDelay: 0.8 }}
                  className="absolute left-1/2 top-1/2 text-lg"
                >
                  {["✨", "⭐", "🌟", "💫"][i % 4]}
                </motion.span>
              ))}
            </div>
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.15 }}
              className="relative mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-[0_0_40px_rgba(251,191,36,0.5)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              🎉
            </motion.div>
            <h2 className="relative font-display text-2xl font-black text-white">
              Welcome{name && !needsName ? `, ${name}` : ""}!
            </h2>
            <p className="relative mt-2 text-sm text-white/70">
              {needsName
                ? "What should we call you on your Curiosity Passport?"
                : "Your Curiosity Passport is ready. Every fact you discover, every chain you follow — it all belongs to you now."}
            </p>

            {needsName && (
              <div className="relative mt-4 text-left">
                <label htmlFor="nickname" className="mb-1 block text-[11px] font-black uppercase tracking-wider text-white/60">
                  Your nickname
                </label>
                <input
                  id="nickname"
                  type="text"
                  autoFocus
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void handleBegin(); }}
                  maxLength={60}
                  placeholder="e.g. Curious Cat"
                  className="w-full rounded-2xl border border-white/20 bg-white/10 px-4 py-3 text-base font-bold text-white placeholder-white/40 outline-none focus:border-white/50"
                />
                {err && <p className="mt-2 text-xs font-bold text-rose-300">{err}</p>}
              </div>
            )}

            {!needsName && (
              <div className="relative mt-4 grid grid-cols-3 gap-2 text-xs">
                {[
                  { i: "🔥", l: "Streaks" },
                  { i: "🎁", l: "Bonuses" },
                  { i: "⭐", l: "Badges" },
                ].map((x) => (
                  <div key={x.l} className="rounded-2xl border border-white/10 bg-white/5 p-2">
                    <div className="text-lg">{x.i}</div>
                    <div className="mt-0.5 text-[10px] font-black uppercase tracking-wide text-white/60">{x.l}</div>
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleBegin}
              disabled={saving}
              className="relative mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] transition hover:scale-[1.02] disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {saving ? "Saving…" : needsName ? "Begin the journey" : "Continue the journey"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CategoryScroller({
  categories,
  activeKey,
  onSelect,
}: {
  categories: typeof CATEGORIES;
  activeKey: CategoryKey;
  onSelect: (key: CategoryKey) => void;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    updateEdges();
    const el = scrollerRef.current;
    if (!el) return;
    el.addEventListener("scroll", updateEdges, { passive: true });
    const ro = new ResizeObserver(updateEdges);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      ro.disconnect();
    };
  }, [updateEdges]);

  const scrollBy = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative mt-5">
      <div
        ref={scrollerRef}
        className="-mx-4 overflow-x-auto scroll-smooth px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <div className="flex gap-2.5 pb-1">
          {categories.map((c) => {
            const active = activeKey === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => onSelect(c.key)}
                className="group flex shrink-0 flex-col items-center gap-1"
                style={{ width: "clamp(3rem, 12vw, 3.75rem)" }}
              >
                <span
                  className={`flex aspect-square w-full items-center justify-center rounded-2xl shadow-lg transition ${
                    active ? "scale-110 ring-2 ring-white/60" : "opacity-80 group-hover:opacity-100"
                  }`}
                  style={{
                    background: c.gradient,
                    boxShadow: active ? `0 10px 24px -8px ${c.glow}` : undefined,
                  }}
                >
                  <span className="leading-none" style={{ fontSize: "clamp(1.25rem, 5vw, 1.6rem)" }}>
                    {c.emoji}
                  </span>
                </span>
                <span
                  className={`w-full truncate text-center text-[10px] font-bold leading-tight ${
                    active ? "text-white" : "text-white/60"
                  }`}
                  title={c.label}
                >
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Edge fades */}
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-background to-transparent transition-opacity ${
          canLeft ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        aria-hidden
        className={`pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-background to-transparent transition-opacity ${
          canRight ? "opacity-100" : "opacity-0"
        }`}
      />

      {/* Floating arrows — visible on hover-capable devices when overflow exists */}
      <button
        type="button"
        aria-label="Scroll categories left"
        onClick={() => scrollBy(-1)}
        className={`absolute left-0 top-[1.5rem] hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-background/80 p-2 text-white shadow-lg backdrop-blur transition hover:scale-110 hover:bg-primary hover:text-primary-foreground sm:flex ${
          canLeft ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        aria-label="Scroll categories right"
        onClick={() => scrollBy(1)}
        className={`absolute right-0 top-[1.5rem] hidden -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-background/80 p-2 text-white shadow-lg backdrop-blur transition hover:scale-110 hover:bg-primary hover:text-primary-foreground sm:flex ${
          canRight ? "opacity-100 animate-pulse" : "pointer-events-none opacity-0"
        }`}
      >
        <ChevronRight className="h-5 w-5" />
      </button>
    </div>
  );
}

