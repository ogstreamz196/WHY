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
