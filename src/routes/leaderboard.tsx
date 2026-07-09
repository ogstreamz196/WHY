import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, CalendarDays, Crown, Flame, Rocket, Sparkles, Star, Sun, Trophy, TrendingUp, Users } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { useCurrentUser } from "@/lib/auth";
import { CATEGORIES, emojiFor } from "@/lib/categories";
import type { LeaderboardKind, LeaderboardResult } from "@/lib/leaderboard.functions";
import { getLeaderboardPublic } from "@/lib/leaderboard-public.functions";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "Curiosity Arena — Why?" },
      { name: "description", content: "Rank on global, weekly, age, category and activity boards." },
    ],
  }),
  component: ArenaPage,
});

type TabKey =
  | "today" | "week" | "month" | "alltime"
  | "rising" | "category" | "age" | "streaks" | "weekend" | "new";

type Tab = {
  key: TabKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const TABS: Tab[] = [
  { key: "today",    label: "Today",    icon: Calendar },
  { key: "week",     label: "Week",     icon: CalendarDays },
  { key: "month",    label: "Month",    icon: TrendingUp },
  { key: "alltime",  label: "All Time", icon: Trophy },
  { key: "rising",   label: "Rising",   icon: Rocket },
  { key: "category", label: "Category", icon: Sparkles },
  { key: "age",      label: "Age",      icon: Users },
  { key: "streaks",  label: "Streaks",  icon: Flame },
  { key: "weekend",  label: "Weekend",  icon: Sun },
  { key: "new",      label: "New",      icon: Star },
];

// Map UI tab -> server (kind, filter)
function resolveQuery(tab: TabKey, filter: string | null): { kind: LeaderboardKind; filter: string | null } {
  switch (tab) {
    case "today":   return { kind: "window", filter: "daily" };
    case "week":    return { kind: "window", filter: "weekly" };
    case "month":   return { kind: "window", filter: "monthly" };
    case "alltime": return { kind: "global", filter: null };
    default:        return { kind: tab as LeaderboardKind, filter };
  }
}

const AGES: Array<{ key: string; label: string }> = [
  { key: "under_10", label: "Under 10" },
  { key: "10_12",    label: "10–12" },
  { key: "teen",     label: "Teen" },
  { key: "adult",    label: "Adult" },
];

// Fun label under the tabs
const TAB_TAGLINE: Record<TabKey, string> = {
  today:    "Today's top explorers · resets at midnight",
  week:     "Rolling 7 days · new week, new climb",
  month:    "This month's champions",
  alltime:  "Lifetime Curiosity Score",
  rising:   "Biggest climbers right now",
  category: "Category legends",
  age:      "Compete inside your age band",
  streaks:  "Longest current fire streaks",
  weekend:  "Weekend warriors",
  new:      "Fresh explorers taking off",
};

function medalClass(rank: number): string {
  if (rank === 1) return "bg-amber-400/25 text-amber-100 shadow-[0_0_24px_rgba(251,191,36,0.35)]";
  if (rank === 2) return "bg-slate-300/20 text-slate-100";
  if (rank === 3) return "bg-orange-400/20 text-orange-200";
  return "bg-white/5 text-white/70";
}

function ArenaPage() {
  const { user } = useCurrentUser();
  const fetchBoard = useServerFn(getLeaderboardPublic);
  const [tab, setTab] = useState<TabKey>("today");
  const [filter, setFilter] = useState<string | null>(null);
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankDelta, setRankDelta] = useState<number | null>(null);

  // Reset filter when tab changes
  useEffect(() => {
    if (tab === "age") setFilter("adult");
    else if (tab === "category") setFilter(CATEGORIES[1]?.key ?? "animals");
    else setFilter(null);
  }, [tab]);

  const [celebrate, setCelebrate] = useState<{ title: string; subtitle: string; tone: string } | null>(null);
  const [confettiTick, setConfettiTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRankDelta(null);
    const q = resolveQuery(tab, filter);
    fetchBoard({ data: { kind: q.kind, filter: q.filter ?? undefined, limit: 50, userId: user?.id } })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        // Rank movement + rank-up celebrations vs last visit (per view, session)
        if (r?.my_rank && r.total_users && typeof window !== "undefined") {
          const rankKey = `lb:rank:${tab}:${filter ?? ""}`;
          const tierKey = `lb:tier:${tab}:${filter ?? ""}`;
          const store = window.sessionStorage;
          const prevRank = Number(store.getItem(rankKey));
          if (Number.isFinite(prevRank) && prevRank > 0) setRankDelta(prevRank - r.my_rank);

          const pct = (r.my_rank / r.total_users) * 100;
          const tierOf = (p: number, rank: number) =>
            rank === 1 ? 6 : p <= 1 ? 5 : p <= 5 ? 4 : rank <= 10 ? 3 : p <= 10 ? 2 : p <= 25 ? 1 : 0;
          const TIER_META = [
            null,
            { title: "Top 25%!", subtitle: "You just cracked the top quarter.", tone: "from-emerald-400 to-teal-500" },
            { title: "Top 10%!", subtitle: "You're in elite company now.", tone: "from-cyan-400 to-emerald-400" },
            { title: "Top 10 rank!", subtitle: "Ten seats from the throne.", tone: "from-fuchsia-500 to-violet-500" },
            { title: "Top 5%!", subtitle: "Officially a Curiosity legend.", tone: "from-fuchsia-400 to-pink-500" },
            { title: "Top 1%!", subtitle: "One in a hundred — nice.", tone: "from-amber-400 to-orange-500" },
            { title: "#1 Champion!", subtitle: "You lead the entire board.", tone: "from-yellow-300 to-amber-500" },
          ] as const;
          const prevTier = Number(store.getItem(tierKey)) || 0;
          const nextTier = tierOf(pct, r.my_rank);
          if (nextTier > prevTier && TIER_META[nextTier]) {
            setCelebrate(TIER_META[nextTier]);
            setConfettiTick((n) => n + 1);
          }
          store.setItem(rankKey, String(r.my_rank));
          store.setItem(tierKey, String(nextTier));
        }
      })
      .catch(() => { if (alive) setResult(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab, filter, fetchBoard, user?.id]);

  const chips = useMemo(() => {
    if (tab === "age")    return AGES;
    if (tab === "category") return CATEGORIES.filter((c) => c.key !== "all").map((c) => ({ key: c.key, label: c.label }));
    return [] as Array<{ key: string; label: string }>;
  }, [tab]);

  const topPercent = result?.my_rank && result.total_users
    ? Math.max(0.1, Math.min(100, (result.my_rank / result.total_users) * 100))
    : null;
  const percentileLabel = topPercent === null
    ? null
    : topPercent < 1
      ? "Top 1%"
      : `Top ${Math.round(topPercent)}%`;
  const percentileTone = topPercent === null
    ? ""
    : topPercent <= 1
      ? "bg-amber-400/25 text-amber-100 shadow-[0_0_28px_rgba(251,191,36,0.45)]"
      : topPercent <= 5
        ? "bg-fuchsia-400/25 text-fuchsia-100"
        : topPercent <= 25
          ? "bg-emerald-400/20 text-emerald-100"
          : "bg-white/10 text-white/80";
  const leaderScore = result?.entries?.[0]?.score ?? 0;

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link to="/quiz" className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-white/90">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-black text-white">Curiosity Arena</h1>
            <p className="text-xs text-white/60">{TAB_TAGLINE[tab]}</p>
          </div>
        </header>

        {/* Tab strip */}
        <div className="glass-strong mb-3 flex gap-1 overflow-x-auto rounded-2xl p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-[11px] font-black uppercase tracking-wider transition ${
                  active ? "text-white shadow-[var(--shadow-glow)]" : "text-white/50"
                }`}
                style={active ? { background: "var(--gradient-primary)" } : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Sub-filter chips */}
        {chips.length > 0 && (
          <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {chips.map((c) => {
              const active = filter === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setFilter(c.key)}
                  className={`shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-bold transition ${
                    active
                      ? "border-fuchsia-300/50 bg-fuchsia-500/15 text-white"
                      : "border-white/10 bg-white/5 text-white/60 hover:text-white/90"
                  }`}
                >
                  {tab === "category" && <span className="mr-1">{emojiFor(c.key)}</span>}
                  {c.label}
                </button>
              );
            })}
          </div>
        )}

        {/* My rank banner */}
        {result?.my_rank && (
          <motion.div
            key={`${tab}-${filter}-me`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong mb-3 flex items-center justify-between rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-3"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-fuchsia-200">Your rank</p>
              <p className="font-display text-xl font-black text-white">
                #{result.my_rank.toLocaleString()}
                <span className="ml-2 text-xs font-bold text-white/60">of {result.total_users.toLocaleString()}</span>
              </p>
              {rankDelta !== null && rankDelta !== 0 && (
                <p className={`mt-0.5 text-[11px] font-black ${rankDelta > 0 ? "text-emerald-300" : "text-rose-300"}`}>
                  {rankDelta > 0
                    ? `▲ Up ${rankDelta.toLocaleString()} since last visit`
                    : `▼ Down ${Math.abs(rankDelta).toLocaleString()} since last visit`}
                </p>
              )}
            </div>
            {percentileLabel && (
              <motion.span
                key={percentileLabel}
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 18 }}
                className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${percentileTone}`}
                title={`${TABS.find((t) => t.key === tab)?.label ?? "This view"} percentile`}
              >
                {topPercent !== null && topPercent <= 5 && <Crown className="h-3 w-3" />}
                {percentileLabel}
              </motion.span>
            )}
          </motion.div>
        )}

        {/* Rows */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : !result || result.entries.length === 0 ? (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <p className="text-sm text-white/70">Nobody's on this board yet. Be the first!</p>
            <Link
              to="/quiz"
              className="mt-3 inline-block rounded-full px-4 py-2 text-xs font-black text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              Start a quiz
            </Link>
          </div>
        ) : (
          <>
            {/* Podium — top 3 */}
            {result.entries.length >= 1 && (
              <Podium entries={result.entries.slice(0, 3)} unit={tab === "streaks" ? "days" : "pts"} meId={user?.id} />
            )}
            <ol className="space-y-2">
              <AnimatePresence initial={false}>
                {result.entries.slice(3).map((r) => {
                  const me = r.user_id === user?.id;
                  const pct = leaderScore > 0 ? Math.max(4, Math.min(100, (r.score / leaderScore) * 100)) : 0;
                  const barGradient = me
                    ? "var(--gradient-primary)"
                    : "linear-gradient(90deg,rgba(255,255,255,0.35),rgba(255,255,255,0.1))";
                  return (
                    <motion.li
                      key={r.user_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ type: "spring", stiffness: 320, damping: 26 }}
                      className={`group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 transition ${
                        me
                          ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                          : "border-white/10 bg-white/[0.04] hover:bg-white/[0.07]"
                      }`}
                    >
                      <span className="w-6 shrink-0 text-center text-sm font-black text-white/50 group-hover:text-white/80">
                        {r.rank}
                      </span>
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-black text-white/80">
                        {(r.display_name || r.username || "E").slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-white">
                          {r.display_name || r.username || "Explorer"}
                          {me && <span className="ml-1 text-[10px] font-black text-fuchsia-300">YOU</span>}
                        </p>
                        <p className="text-[11px] text-white/50">
                          {r.favorite_category ? `${emojiFor(r.favorite_category)} ${r.favorite_category}` : "Curious mind"}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: barGradient }}
                          />
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-black text-white">{r.score.toLocaleString()}</p>
                        <p className="text-[9px] font-black uppercase tracking-widest text-white/40">
                          {tab === "streaks" ? "days" : "pts"}
                        </p>
                      </div>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          </>
        )}

      </div>
      <BottomNav />
      <ConfettiBurst trigger={confettiTick} duration={2200} />
      <AnimatePresence>
        {celebrate && (
          <motion.div
            key="rankup"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setCelebrate(null)}
          >
            <motion.div
              initial={{ scale: 0.6, y: 30, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
              className="glass-strong relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/15 p-6 text-center shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className={`mx-auto mb-4 flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br ${celebrate.tone} shadow-[0_10px_40px_rgba(251,191,36,0.5)]`}>
                <motion.div
                  animate={{ rotate: [-8, 8, -8], scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Trophy className="h-12 w-12 text-white drop-shadow-lg" />
                </motion.div>
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                Rank up · {TABS.find((t) => t.key === tab)?.label}
              </p>
              <h2 className="mt-1 font-display text-3xl font-black text-white">{celebrate.title}</h2>
              <p className="mt-2 text-sm text-white/70">{celebrate.subtitle}</p>
              {result?.my_rank && result.total_users && (
                <div className="mt-5">
                  <div className="mb-1 flex justify-between text-[10px] font-black uppercase tracking-widest text-white/60">
                    <span>#{result.my_rank.toLocaleString()}</span>
                    <span>of {result.total_users.toLocaleString()}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.max(2, 100 - (result.my_rank / result.total_users) * 100)}%` }}
                      transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full bg-gradient-to-r ${celebrate.tone}`}
                    />
                  </div>
                </div>
              )}
              <button
                type="button"
                onClick={() => setCelebrate(null)}
                className="mt-6 w-full rounded-full px-5 py-3 text-sm font-black text-white"
                style={{ background: "var(--gradient-primary)" }}
              >
                Keep climbing
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

type PodiumEntry = LeaderboardResult["entries"][number];

function Podium({ entries, unit, meId }: { entries: PodiumEntry[]; unit: string; meId?: string }) {
  const byRank = (n: number) => entries.find((e) => e.rank === n);
  const first = byRank(1);
  const second = byRank(2);
  const third = byRank(3);

  return (
    <div className="mb-4 grid grid-cols-3 items-end gap-2 pt-6">
      {second ? <PodiumColumn entry={second} place={2} unit={unit} isMe={second.user_id === meId} /> : <div />}
      {first ? <PodiumColumn entry={first} place={1} unit={unit} isMe={first.user_id === meId} /> : <div />}
      {third ? <PodiumColumn entry={third} place={3} unit={unit} isMe={third.user_id === meId} /> : <div />}
    </div>
  );
}

function PodiumColumn({ entry, place, unit, isMe }: { entry: PodiumEntry; place: 1 | 2 | 3; unit: string; isMe: boolean }) {
  const cfg = {
    1: {
      delay: 0.15,
      avatar: "w-24 h-24 rounded-3xl",
      ring: "bg-gradient-to-br from-amber-300 via-yellow-500 to-amber-600 shadow-[0_0_40px_-8px_rgba(245,158,11,0.6)]",
      inner: "rounded-[22px]",
      textTone: "text-amber-300",
      badge: "shimmer-gold text-black",
      badgeSize: "w-9 h-9 text-xs",
      pillar: "h-40 bg-gradient-to-t from-amber-900/40 to-amber-500/25 border-amber-400/50",
      label: "text-sm tracking-[0.2em]",
      score: "text-2xl",
      crown: true,
    },
    2: {
      delay: 0,
      avatar: "w-16 h-16 rounded-2xl",
      ring: "bg-gradient-to-br from-slate-200 to-slate-500 shadow-[0_0_24px_-8px_rgba(203,213,225,0.5)]",
      inner: "rounded-[14px]",
      textTone: "text-slate-300",
      badge: "bg-slate-300 text-black",
      badgeSize: "w-7 h-7 text-[10px]",
      pillar: "h-24 bg-gradient-to-t from-slate-900/50 to-slate-400/25 border-slate-400/40",
      label: "text-xs tracking-widest",
      score: "text-lg",
      crown: false,
    },
    3: {
      delay: 0.3,
      avatar: "w-16 h-16 rounded-2xl",
      ring: "bg-gradient-to-br from-orange-500 to-stone-700 shadow-[0_0_20px_-8px_rgba(234,88,12,0.5)]",
      inner: "rounded-[14px]",
      textTone: "text-orange-400",
      badge: "bg-orange-600 text-white",
      badgeSize: "w-7 h-7 text-[10px]",
      pillar: "h-16 bg-gradient-to-t from-orange-950/50 to-orange-700/20 border-orange-700/40",
      label: "text-xs tracking-widest",
      score: "text-lg",
      crown: false,
    },
  }[place];

  const name = entry.display_name || entry.username || "Explorer";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <motion.div
      className="flex flex-col items-center"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: cfg.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.div
        className="relative mb-3"
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: cfg.delay }}
      >
        {cfg.crown && (
          <motion.div
            className="absolute -top-8 left-1/2 -translate-x-1/2"
            animate={{ rotate: [-6, 6, -6] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Crown className="h-7 w-7 fill-amber-400 text-amber-400 drop-shadow-[0_2px_10px_rgba(251,191,36,0.7)]" />
          </motion.div>
        )}
        <div className={`${cfg.avatar} ${cfg.ring} p-0.5`}>
          <div className={`flex h-full w-full items-center justify-center overflow-hidden bg-neutral-950 ${cfg.inner}`}>
            <span className={`font-black ${cfg.textTone} ${place === 1 ? "text-3xl" : "text-xl"}`}>{initial}</span>
          </div>
        </div>
        <div
          className={`absolute -top-2 -right-2 flex items-center justify-center rounded-full border-[3px] border-[color:var(--background,#050505)] font-black shadow-lg ${cfg.badge} ${cfg.badgeSize}`}
        >
          {place}
        </div>
      </motion.div>
      <div className="mb-2 text-center">
        <div className={`font-black uppercase ${cfg.label} ${place === 1 ? "text-amber-300" : cfg.textTone}`}>
          {name}
          {isMe && <span className="ml-1 text-[9px] text-fuchsia-300">YOU</span>}
        </div>
        <div className={`font-black text-white ${cfg.score}`}>
          {entry.score.toLocaleString()}
          <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-white/50">{unit}</span>
        </div>
      </div>
      <motion.div
        className={`relative w-full overflow-hidden rounded-t-2xl border-x border-t ${cfg.pillar}`}
        initial={{ scaleY: 0, transformOrigin: "bottom" }}
        animate={{ scaleY: 1 }}
        transition={{ delay: cfg.delay + 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
        {place === 1 && <div className="absolute inset-0 animate-pulse bg-amber-400/5" />}
      </motion.div>
    </motion.div>
  );
}

