import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, CalendarDays, Crown, Flame, Rocket, Sparkles, Star, Sun, Trophy, TrendingUp, Users } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { useCurrentUser } from "@/lib/auth";
import { CATEGORIES, emojiFor } from "@/lib/categories";
import { getLeaderboard, type LeaderboardKind, type LeaderboardResult } from "@/lib/leaderboard.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
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
  const fetchBoard = useServerFn(getLeaderboard);
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

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setRankDelta(null);
    const q = resolveQuery(tab, filter);
    fetchBoard({ data: { kind: q.kind, filter: q.filter ?? undefined, limit: 50 } })
      .then((r) => {
        if (!alive) return;
        setResult(r);
        // Rank movement vs last visit (per view, local)
        if (r?.my_rank && typeof window !== "undefined") {
          const key = `lb:rank:${tab}:${filter ?? ""}`;
          const prev = Number(window.localStorage.getItem(key));
          if (Number.isFinite(prev) && prev > 0) setRankDelta(prev - r.my_rank);
          window.localStorage.setItem(key, String(r.my_rank));
        }
      })
      .catch(() => { if (alive) setResult(null); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [tab, filter, fetchBoard]);

  const chips = useMemo(() => {
    if (tab === "age")    return AGES;
    if (tab === "category") return CATEGORIES.filter((c) => c.key !== "all").map((c) => ({ key: c.key, label: c.label }));
    return [] as Array<{ key: string; label: string }>;
  }, [tab]);

  const topPercent = result?.my_rank && result.total_users
    ? Math.max(1, Math.round((result.my_rank / result.total_users) * 100))
    : null;

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
            </div>
            {topPercent !== null && topPercent <= 25 && (
              <span className="rounded-full bg-amber-400/20 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-100">
                Top {topPercent}%
              </span>
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
          <ol className="space-y-2">
            <AnimatePresence initial={false}>
              {result.entries.map((r) => {
                const me = r.user_id === user?.id;
                return (
                  <motion.li
                    key={r.user_id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                    className={`flex items-center gap-3 rounded-2xl border p-3 ${
                      me
                        ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                        : "border-white/10 bg-white/[0.04]"
                    }`}
                  >
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${medalClass(r.rank)}`}
                    >
                      {r.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-white">
                        {r.display_name || r.username || "Explorer"}
                        {me && <span className="ml-1 text-[10px] font-black text-fuchsia-300">YOU</span>}
                      </p>
                      <p className="text-[11px] text-white/50">
                        {r.favorite_category ? `${emojiFor(r.favorite_category)} ${r.favorite_category}` : "Curious mind"}
                      </p>
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
        )}
      </div>
      <BottomNav />
    </main>
  );
}
