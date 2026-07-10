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
import { VipBadge } from "@/components/VipBadge";
import { PlayerProfileModal } from "@/components/PlayerProfileModal";

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

// Shared tap / focus / hover behaviour for every clickable player surface
// (podium columns, leaderboard rows, "Your rank" banner) so keyboard, mouse
// and touch all get the same affordances.
const INTERACTIVE_PLAYER =
  "min-h-11 cursor-pointer transition-transform transition-shadow duration-200 " +
  "hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.98] " +
  "focus:outline-none focus-visible:outline-none focus-visible:ring-2 " +
  "focus-visible:ring-fuchsia-300/70 focus-visible:ring-offset-2 " +
  "focus-visible:ring-offset-transparent " +
  "disabled:cursor-default disabled:opacity-100 disabled:hover:translate-y-0 disabled:hover:shadow-none";


function ArenaPage() {
  const { user } = useCurrentUser();
  const fetchBoard = useServerFn(getLeaderboardPublic);
  const [tab, setTab] = useState<TabKey>("today");
  const [filter, setFilter] = useState<string | null>(null);
  const [result, setResult] = useState<LeaderboardResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [rankDelta, setRankDelta] = useState<number | null>(null);
  const [selected, setSelected] = useState<{ userId: string; rank: number } | null>(null);
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
          <motion.button
            type="button"
            key={`${tab}-${filter}-me`}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => user?.id && setSelected({ userId: user.id, rank: result.my_rank! })}
            disabled={!user?.id}
            aria-label="View your player profile"
            className={`glass-strong mb-3 flex w-full items-center justify-between rounded-2xl border border-fuchsia-300/40 bg-fuchsia-500/10 p-3 text-left ring-2 ring-fuchsia-300/40 hover:bg-fuchsia-500/15 ${INTERACTIVE_PLAYER}`}
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
          </motion.button>
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
          <motion.div
            key={tab + (filter ?? "")}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            className="arena-active"
          >
            {/* Podium — top 3 */}
            {result.entries.length >= 1 && (
              <Podium
                entries={result.entries.slice(0, 3)}
                unit={tab === "streaks" ? "days" : "pts"}
                meId={user?.id}
                onOpen={(userId, rank) => setSelected({ userId, rank })}
              />
            )}
            <ol className="space-y-2">

              <AnimatePresence initial={false}>
                {result.entries.slice(3).map((r) => {
                  const me = r.user_id === user?.id;
                  const pct = leaderScore > 0 ? Math.max(4, Math.min(100, (r.score / leaderScore) * 100)) : 0;
                  const barGradient = me
                    ? "var(--gradient-primary)"
                    : "linear-gradient(90deg,rgba(255,255,255,0.35),rgba(255,255,255,0.1))";
                  const totalUsers = result.total_users || result.entries.length;
                  const topPct = Math.max(1, Math.ceil((r.rank / totalUsers) * 100));
                  const honor = honorFor(r.rank, topPct);
                  return (
                    <motion.li
                      key={r.user_id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ type: "spring", stiffness: 320, damping: 26 }}
                    >
                      <button
                        type="button"
                        onClick={() => setSelected({ userId: r.user_id, rank: r.rank })}
                        aria-label={`View ${r.display_name || r.username || "Explorer"}'s profile, rank ${r.rank}`}
                        className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 hover:-translate-y-0.5 hover:shadow-lg active:scale-[0.995] ${
                          me
                            ? "border-fuchsia-300/60 bg-fuchsia-500/15 shadow-[0_0_28px_rgba(217,70,239,0.28)] ring-2 ring-fuchsia-300/40"
                            : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                        }`}
                      >
                        {me && (
                          <motion.span
                            aria-hidden
                            className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-fuchsia-300/60"
                            animate={{ opacity: [0.35, 0.9, 0.35] }}
                            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                          />
                        )}
                        <div className="relative flex w-14 shrink-0 flex-col items-center gap-0.5">
                          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${honor.tone}`}>
                            {honor.label}
                          </span>
                          <span className="text-[10px] font-black text-white/40">#{r.rank}</span>
                        </div>
                        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-black text-white/80">
                          {(r.display_name || r.username || "E").slice(0, 1).toUpperCase()}
                        </div>
                        <div className="relative min-w-0 flex-1">
                          <p className="truncate text-sm font-black text-white">
                            {r.display_name || r.username || "Explorer"}
                            {r.is_vip && <VipBadge size="xs" className="ml-1.5" />}
                            {me && <span className="ml-1 text-[10px] font-black text-fuchsia-200">YOU</span>}
                          </p>
                          <p className="truncate text-[11px] text-white/60">
                            {honor.cheer}
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
                        <div className="relative text-right">
                          <p className="text-lg font-black text-white">{r.score.toLocaleString()}</p>
                          <p className="text-[9px] font-black uppercase tracking-widest text-white/40">
                            {tab === "streaks" ? "days" : "pts"}
                          </p>
                        </div>
                      </button>
                    </motion.li>
                  );
                })}
              </AnimatePresence>
            </ol>
          </motion.div>
        )}

      </div>
      <BottomNav />
      <ConfettiBurst trigger={confettiTick} duration={2200} />
      <PlayerProfileModal
        userId={selected?.userId ?? null}
        rank={selected?.rank ?? null}
        totalUsers={result?.total_users ?? null}
        boardLabel={TABS.find((t) => t.key === tab)?.label}
        isMe={!!selected && selected.userId === user?.id}
        onClose={() => setSelected(null)}
      />
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

function honorFor(rank: number, topPct: number): { label: string; cheer: string; tone: string } {
  if (rank <= 10) return {
    label: "Top 10",
    cheer: "Elite of the arena — legends rise here. Keep the throne in sight! 👑",
    tone: "border-amber-300/40 bg-amber-400/15 text-amber-200",
  };
  if (topPct <= 5) return {
    label: `Top ${topPct}%`,
    cheer: "Absolute powerhouse — the podium is within striking distance! ⚡",
    tone: "border-fuchsia-300/40 bg-fuchsia-500/15 text-fuchsia-200",
  };
  if (topPct <= 10) return {
    label: `Top ${topPct}%`,
    cheer: "Top-tier curiosity — you're outpacing the pack. Push higher! 🚀",
    tone: "border-sky-300/40 bg-sky-500/15 text-sky-200",
  };
  if (topPct <= 25) return {
    label: `Top ${topPct}%`,
    cheer: "Serious climber — the leaderboard is bending your way. 🔥",
    tone: "border-emerald-300/40 bg-emerald-500/15 text-emerald-200",
  };
  if (topPct <= 50) return {
    label: `Top ${topPct}%`,
    cheer: "Ahead of the field — momentum is on your side. Keep going! 💪",
    tone: "border-teal-300/40 bg-teal-500/15 text-teal-200",
  };
  return {
    label: `Top ${topPct}%`,
    cheer: "Every discovery lifts your rank — the climb starts now. ✨",
    tone: "border-white/15 bg-white/5 text-white/70",
  };
}


function Podium({ entries, unit, meId, onOpen }: { entries: PodiumEntry[]; unit: string; meId?: string; onOpen: (userId: string, rank: number) => void }) {
  const byRank = (n: number) => entries.find((e) => e.rank === n);
  const first = byRank(1);
  const second = byRank(2);
  const third = byRank(3);

  return (
    <div className="relative mb-4 pt-14">
      {/* Ambient gold halo behind #1 */}
      <div
        className="pointer-events-none absolute inset-x-0 top-4 mx-auto h-40 max-w-[220px] rounded-full bg-amber-400/10 blur-3xl"
        aria-hidden="true"
      />
      <div className="relative flex items-end justify-center gap-2 sm:gap-4">
        {second ? (
          <PodiumColumn entry={second} place={2} unit={unit} isMe={second.user_id === meId} onOpen={onOpen} />
        ) : (
          <div className="w-full max-w-[140px]" />
        )}
        {first ? (
          <PodiumColumn entry={first} place={1} unit={unit} isMe={first.user_id === meId} onOpen={onOpen} />
        ) : (
          <div className="w-full max-w-[180px]" />
        )}
        {third ? (
          <PodiumColumn entry={third} place={3} unit={unit} isMe={third.user_id === meId} onOpen={onOpen} />
        ) : (
          <div className="w-full max-w-[130px]" />
        )}
      </div>
    </div>
  );
}

const PODIUM_CFG = {
  1: {
    delay: 0.15,
    wrap: "w-full max-w-[180px] z-10",
    avatar: "w-24 h-24 sm:w-28 sm:h-28",
    ring: "border-4 border-amber-400 shadow-[0_0_40px_rgba(251,191,36,0.35)]",
    chip: "w-10 h-10 bg-gradient-to-br from-amber-300 to-amber-600 border-amber-200 text-amber-950 text-base",
    card: "h-64 sm:h-72 rounded-t-[2.25rem] border-t-2 border-x-2 border-amber-400/40 bg-gradient-to-b from-amber-500/12 to-transparent shadow-[0_-25px_60px_-15px_rgba(251,191,36,0.25)] podium-shimmer",
    medal: "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.55)]",
    medalSize: "h-9 w-9",
    name: "shimmer-gold-text text-lg sm:text-xl font-black tracking-tight",
    score: "text-amber-300 text-base font-black",
    tier: "Grandmaster",
    tierPill: "shimmer-gold-text bg-amber-400/15 border border-amber-400/40",

  },
  2: {
    delay: 0,
    wrap: "w-full max-w-[140px]",
    avatar: "w-16 h-16 sm:w-20 sm:h-20",
    ring: "border-4 border-slate-400/50 shadow-lg",
    chip: "w-8 h-8 bg-slate-200 border-slate-400 text-slate-900 text-sm",
    card: "h-48 sm:h-56 rounded-t-3xl border-t border-x border-slate-400/25 bg-white/[0.03]",
    medal: "text-slate-300",
    medalSize: "h-7 w-7",
    name: "text-white text-sm font-bold",
    score: "text-slate-300 text-xs font-black",
    tier: "Challenger",
    tierPill: "bg-slate-400/10 border-slate-400/25 text-slate-300",
  },
  3: {
    delay: 0.3,
    wrap: "w-full max-w-[130px]",
    avatar: "w-14 h-14 sm:w-16 sm:h-16",
    ring: "border-4 border-orange-700/50 shadow-md",
    chip: "w-7 h-7 bg-orange-700 border-orange-400 text-orange-50 text-xs",
    card: "h-40 sm:h-48 rounded-t-3xl border-t border-x border-orange-700/25 bg-white/[0.02]",
    medal: "text-orange-500/90",
    medalSize: "h-6 w-6",
    name: "text-white/90 text-sm font-bold",
    score: "text-orange-300/90 text-xs font-black",
    tier: "Veteran",
    tierPill: "bg-orange-900/25 border-orange-700/30 text-orange-300",
  },
} as const;

function PodiumColumn({ entry, place, unit, isMe, onOpen }: { entry: PodiumEntry; place: 1 | 2 | 3; unit: string; isMe: boolean; onOpen: (userId: string, rank: number) => void }) {
  const cfg = PODIUM_CFG[place];
  const name = entry.display_name || entry.username || "Explorer";
  const initial = name.slice(0, 1).toUpperCase();

  return (
    <motion.button
      type="button"
      onClick={() => onOpen(entry.user_id, entry.rank)}
      aria-label={`View ${name}'s profile, rank ${place}`}
      className={`relative flex flex-col items-center ${cfg.wrap} cursor-pointer rounded-t-[2rem] transition hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70 active:scale-[0.98]`}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: cfg.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      {/* Floating crown on champion */}
      {place === 1 && (
        <motion.div
          className="absolute -top-12 z-20"
          animate={{ y: [0, -4, 0], rotate: [-4, 4, -4] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          aria-hidden="true"
        >
          <Crown className="h-10 w-10 fill-amber-400 text-amber-400 drop-shadow-[0_0_14px_rgba(251,191,36,0.7)]" />
        </motion.div>
      )}

      {/* Avatar with rank chip */}
      <div className="relative z-20 mb-3">
        <div className={`relative ${cfg.avatar} rounded-full ${cfg.ring} bg-neutral-950 p-1.5`}>
          <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-white/10 to-white/0">
            <span className={`font-black text-white ${place === 1 ? "text-3xl" : "text-lg"}`}>{initial}</span>
          </div>
        </div>
        <div
          className={`absolute -bottom-1 -right-1 flex items-center justify-center rounded-full border-2 font-black shadow-xl ${cfg.chip}`}
          aria-label={`Rank ${place}`}
        >
          {place}
        </div>
      </div>

      {/* Card / pillar */}
      <motion.div
        className={`relative flex w-full flex-col items-center overflow-hidden px-3 pb-5 pt-6 text-center backdrop-blur-xl transition-colors ${cfg.card}`}
        initial={{ scaleY: 0.4, opacity: 0, transformOrigin: "bottom" }}
        animate={{ scaleY: 1, opacity: 1 }}
        transition={{ delay: cfg.delay + 0.15, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
      >
        {/* Victory medal */}
        <div className={`mb-3 ${cfg.medal}`} aria-hidden="true">
          <Trophy className={cfg.medalSize} strokeWidth={2.2} />
        </div>

        <p className={`w-full truncate ${cfg.name}`}>
          {name}
          {entry.is_vip && <VipBadge size="xs" className="ml-1" />}
          {isMe && <span className="ml-1 text-[9px] text-fuchsia-300">YOU</span>}
        </p>
        <p className={`mt-1 ${cfg.score}`}>
          {entry.score.toLocaleString()}
          <span className="ml-1 text-[9px] font-black uppercase tracking-widest text-white/45">{unit}</span>
        </p>

        <div className="mt-auto pt-3">
          <span
            className={`inline-block rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.22em] ${cfg.tierPill}`}
          >
            {cfg.tier}
          </span>
        </div>
      </motion.div>
    </motion.button>
  );
}


