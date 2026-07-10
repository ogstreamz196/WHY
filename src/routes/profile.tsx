import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, LogOut, Sparkles, Trophy, Zap, Pencil, Loader2, Check, Clock, ArrowRight, ArrowUpDown, ChevronDown, Crown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  getMyStats,
  listAchievements,
  type Achievement,
} from "@/lib/account.functions";
import { getMyRankings } from "@/lib/leaderboard.functions";
import { getMyQuizStats } from "@/lib/quiz.functions";
import {
  getDiscoveryTimeline,
  getCategoryInterests,
  listMyChains,
} from "@/lib/chains.functions";
import { CoinIcon } from "@/components/CoinIcon";
import { levelFor } from "@/lib/levels";
import { BottomNav } from "@/components/BottomNav";
import { StreakBadges } from "@/components/StreakBadges";
import { BadgeDetailsModal } from "@/components/BadgeDetailsModal";
import { LevelProgressWidget } from "@/components/LevelProgressWidget";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { LevelUpCelebration } from "@/components/LevelUpCelebration";
import { useUnlockWatcher } from "@/lib/unlock-watch";
import { getBadges, getPoints, getSeen, getStreak, type Badge } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth";
import { STORE_CATALOG } from "@/lib/store";
import { emojiFor } from "@/lib/categories";
import { VipBadge } from "@/components/VipBadge";
import { useSubscription } from "@/hooks/useSubscription";

const MILESTONES = [
  { key: "seen",   label: "Facts discovered", steps: [10, 50, 100, 250, 500, 1000] },
  { key: "streak", label: "Day streak",       steps: [3, 7, 14, 30, 60, 100] },
  { key: "points", label: "Curiosity points", steps: [100, 500, 1000, 5000, 10000, 25000] },
] as const;

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Your profile — Why?" }, { name: "theme-color", content: "#100c1f" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const { isVip } = useSubscription(user?.id);
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchProfile = useServerFn(getMyProfile);
  const fetchStats = useServerFn(getMyStats);
  const fetchAchievements = useServerFn(listAchievements);
  const doUpdate = useServerFn(updateMyProfile);
  const fetchTimeline = useServerFn(getDiscoveryTimeline);
  const fetchInterests = useServerFn(getCategoryInterests);
  const fetchChains = useServerFn(listMyChains);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchStats(),
    enabled: !!user,
  });
  const achievements = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchAchievements(),
    enabled: !!user,
  });
  const timeline = useInfiniteQuery({
    queryKey: ["timeline"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchTimeline({ data: { limit: 15, offset: pageParam as number } }),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!user,
  });
  const interests = useQuery({
    queryKey: ["interests"],
    queryFn: () => fetchInterests(),
    enabled: !!user,
  });
  const chains = useInfiniteQuery({
    queryKey: ["chains", "profile"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchChains({ data: { limit: 10, offset: pageParam as number } }),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!user,
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);
  const [sectionOrder, setSectionOrder] = useState<"achievements-first" | "discoveries-first">(
    "achievements-first",
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("profile:sectionOrder");
    if (saved === "achievements-first" || saved === "discoveries-first") {
      setSectionOrder(saved);
    }
  }, []);

  const toggleSectionOrder = () => {
    setSectionOrder((prev) => {
      const next = prev === "achievements-first" ? "discoveries-first" : "achievements-first";
      if (typeof window !== "undefined") {
        window.localStorage.setItem("profile:sectionOrder", next);
      }
      return next;
    });
  };

  type CollapseKey =
    | "achievements"
    | "discoveries"
    | "interests"
    | "chains"
    | "quiz"
    | "rankings";
  const [collapsed, setCollapsed] = useState<Record<CollapseKey, boolean>>({
    achievements: false,
    discoveries: false,
    interests: false,
    chains: false,
    quiz: false,
    rankings: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem("profile:collapsed");
      if (raw) {
        const parsed = JSON.parse(raw);
        setCollapsed((prev) => ({
          ...prev,
          ...Object.fromEntries(
            Object.keys(prev).map((k) => [k, !!parsed[k]]),
          ),
        }));
      }
    } catch {}
  }, []);

  const toggleCollapsed = (key: CollapseKey) => {
    setCollapsed((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      if (typeof window !== "undefined") {
        window.localStorage.setItem("profile:collapsed", JSON.stringify(next));
      }
      return next;
    });
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/profile" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? "");
      setBio(profile.data.bio ?? "");
    }
  }, [profile.data]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }

  const s = stats.data ?? { total_points: 0, current_streak: 0, longest_streak: 0, facts_seen: 0 };
  const lvl = levelFor(s.total_points);
  const level = lvl.level;
  const levelPct = lvl.progressPct;
  const avatar = STORE_CATALOG.find((i) => i.id === profile.data?.avatar_id) ?? STORE_CATALOG[0];
  const unlockedCount = (achievements.data ?? []).filter((a) => a.unlocked_at).length;

  async function save() {
    setSaving(true);
    try {
      await doUpdate({ data: { display_name: name.trim() || undefined, bio: bio.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong relative overflow-hidden rounded-4xl border border-white/10 p-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="flex items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <span>{avatar?.emoji ?? "🌱"}</span>
            </div>
            <div className="flex-1">
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1 font-display text-xl font-black text-white outline-none"
                />
              ) : (
                <h1 className="font-display text-2xl font-black text-white flex items-center gap-2 flex-wrap">
                  <span>{profile.data?.display_name ?? "Curious explorer"}</span>
                  {isVip && <VipBadge size="md" />}
                </h1>
              )}
              <p className="mt-0.5 text-xs text-white/50">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => (editing ? save() : setEditing(true))}
              disabled={saving}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"
              aria-label={editing ? "Save" : "Edit profile"}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>

          {editing && (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world what makes you curious…"
              maxLength={280}
              rows={2}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none"
            />
          )}
          {!editing && profile.data?.bio && (
            <p className="mt-3 text-sm italic text-white/70">"{profile.data.bio}"</p>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest">
              <span className="text-white/50">Lvl {level} · <span className="text-white/80">{lvl.title}</span></span>
              <span className="text-white/50">
                {lvl.next ? `${lvl.xpToNext} XP to ${lvl.next.title}` : "Max tier"}
              </span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--gradient-primary)" }}
                initial={{ width: 0 }}
                animate={{ width: `${levelPct}%` }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </div>

          <Link
            to="/recap"
            className="mt-4 flex items-center justify-between gap-3 rounded-2xl border border-violet-400/25 bg-violet-500/10 px-4 py-2.5 text-sm transition hover:bg-violet-500/15"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-300" />
              <span className="font-black text-white">Your curiosity week</span>
            </span>
            <ArrowRight className="h-4 w-4 text-white/60" />
          </Link>

          <nav aria-label="Jump to profile section" className="mt-3 flex flex-wrap gap-2">
            <a
              href="#achievements"
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/25 bg-amber-400/10 px-3 py-1.5 text-xs font-black text-amber-100 transition hover:bg-amber-400/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300/60"
            >
              <Trophy className="h-3.5 w-3.5" aria-hidden="true" /> Achievements
            </a>
            <a
              href="#recent-discoveries"
              className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-black text-white/85 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            >
              <Clock className="h-3.5 w-3.5" aria-hidden="true" /> Recent discoveries
            </a>
            {user?.email?.toLowerCase() === "ogstreamz196@gmail.com" && (
              <Link
                to="/boss"
                className="inline-flex items-center gap-1.5 rounded-full border border-fuchsia-300/40 bg-gradient-to-r from-sky-500/30 via-fuchsia-500/25 to-red-500/25 px-3 py-1.5 text-xs font-black text-white shadow-[0_0_18px_-4px_rgba(217,70,239,0.6)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/60"
              >
                <Crown className="h-3.5 w-3.5 fill-amber-300 text-amber-300" aria-hidden="true" /> Boss Dashboard
              </Link>
            )}
          </nav>

        </motion.div>

        {/* Stats grid */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <StatTile icon={<CoinIcon size={20} />} label="Y-Coins" value={s.total_points} />
          <StatTile icon={<Flame className="h-5 w-5 text-orange-400" />} label="Streak" value={`${s.current_streak} 🔥`} />
          <StatTile icon={<Zap className="h-5 w-5 text-yellow-300" />} label="Longest streak" value={s.longest_streak} />
          <StatTile icon={<Sparkles className="h-5 w-5 text-fuchsia-300" />} label="Facts seen" value={s.facts_seen} />
        </section>

        <StreakBadges currentStreak={s.current_streak} longestStreak={s.longest_streak} />

        <CollapsibleWrap
          collapsed={collapsed.quiz}
          onToggle={() => toggleCollapsed("quiz")}
          label="Quiz stats"
        >
          <QuizStatsSection />
        </CollapsibleWrap>

        <CollapsibleWrap
          collapsed={collapsed.rankings}
          onToggle={() => toggleCollapsed("rankings")}
          label="Your Curiosity Rankings"
        >
          <MyRankingsSection />
        </CollapsibleWrap>







        {/* Category interests */}
        {interests.data && interests.data.length > 0 && (
          <section className="mt-6">
            <header className="mb-3 flex items-center justify-between">
              <h2 className="font-display text-lg font-black text-white">Your curiosity map</h2>
              <CollapseChevron
                collapsed={collapsed.interests}
                onToggle={() => toggleCollapsed("interests")}
                label="curiosity map"
              />
            </header>
            {!collapsed.interests && (
              <div className="flex flex-wrap gap-2">
                {interests.data.slice(0, 8).map((it) => (
                  <div key={it.category} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/85">
                    <span>{emojiFor(it.category)}</span>
                    <span className="capitalize">{it.category}</span>
                    <span className="text-white/50">·{it.weight}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Saved chains */}
        <section className="mt-6">
          <header className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-display text-lg font-black text-white">Saved chains</h2>
            <div className="flex items-center gap-2">
              <Link to="/chains" className="text-xs font-bold text-fuchsia-200">
                View all →
              </Link>
              <CollapseChevron
                collapsed={collapsed.chains}
                onToggle={() => toggleCollapsed("chains")}
                label="Saved chains"
              />
            </div>
          </header>
          {!collapsed.chains && (() => {

            const items = chains.data?.pages.flatMap((p) => p.items) ?? [];
            if (items.length === 0) {
              return (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
                  Save your first Why chain from the home screen.
                </p>
              );
            }
            return (
              <div className="space-y-2">
                {items.map((c) => (
                  <Link
                    key={c.id}
                    to="/chain/$id"
                    params={{ id: c.id }}
                    className="glass flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2.5"
                  >
                    <Sparkles className="h-4 w-4 text-fuchsia-300" />
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-sm font-bold text-white">{c.title ?? "Untitled chain"}</div>
                      <div className="text-[10px] text-white/50">{c.step_count} steps</div>
                    </div>
                    <ArrowRight className="h-4 w-4 text-white/40" />
                  </Link>
                ))}
                {chains.hasNextPage && (
                  <button
                    type="button"
                    onClick={() => chains.fetchNextPage()}
                    disabled={chains.isFetchingNextPage}
                    className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80"
                  >
                    {chains.isFetchingNextPage ? "Loading…" : "Load more chains"}
                  </button>
                )}
              </div>
            );
          })()}
        </section>

        {(() => {
          const achievementsSection = (
            <section
              key="achievements"
              id="achievements"
              aria-labelledby="achievements-heading"
              className="mt-14 scroll-mt-24 pt-8"
            >
              <div
                aria-hidden="true"
                className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-amber-300/40 to-transparent"
              />
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-amber-300/30 bg-amber-400/15 text-amber-200 shadow-[0_0_20px_-6px_rgba(251,191,36,0.6)]">
                  <Trophy className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-200/70">
                    Section
                  </p>
                  <h2
                    id="achievements-heading"
                    className="font-display text-xl font-black leading-tight text-white"
                  >
                    Achievements
                  </h2>
                </div>
                <span className="inline-flex h-7 shrink-0 items-center rounded-full border border-amber-300/25 bg-amber-400/10 px-2.5 text-xs font-black text-amber-100">
                  {unlockedCount}/{achievements.data?.length ?? 0}
                </span>
                <button
                  type="button"
                  onClick={toggleSectionOrder}
                  data-no-chrome
                  className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 text-[10px] font-black uppercase tracking-wider text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  aria-label={
                    sectionOrder === "achievements-first"
                      ? "Show Recent discoveries above Achievements"
                      : "Show Achievements above Recent discoveries"
                  }
                >
                  <ArrowUpDown className="h-3 w-3" aria-hidden="true" /> Swap
                </button>
                <button
                  type="button"
                  onClick={() => toggleCollapsed("achievements")}
                  data-no-chrome
                  aria-expanded={!collapsed.achievements}
                  aria-controls="achievements-body"
                  aria-label={collapsed.achievements ? "Expand Achievements" : "Collapse Achievements"}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${collapsed.achievements ? "-rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {!collapsed.achievements && (
                <div id="achievements-body" className="grid grid-cols-3 gap-3">
                  {(achievements.data ?? []).map((a) => (
                    <AchievementTile key={a.id} a={a} />
                  ))}
                </div>
              )}
            </section>
          );

          const discoveriesSection = (
            <section
              key="recent-discoveries"
              id="recent-discoveries"
              aria-labelledby="recent-discoveries-heading"
              className="mt-14 scroll-mt-24 pt-8"
            >
              <div
                aria-hidden="true"
                className="mb-6 h-px w-full bg-gradient-to-r from-transparent via-sky-300/40 to-transparent"
              />
              <div className="mb-5 flex items-center gap-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-sky-300/30 bg-sky-400/15 text-sky-200 shadow-[0_0_20px_-6px_rgba(56,189,248,0.55)]">
                  <Clock className="h-4 w-4" aria-hidden="true" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-sky-200/70">
                    Section
                  </p>
                  <h2
                    id="recent-discoveries-heading"
                    className="font-display text-xl font-black leading-tight text-white"
                  >
                    Recent discoveries
                  </h2>
                </div>
                <button
                  type="button"
                  onClick={() => toggleCollapsed("discoveries")}
                  data-no-chrome
                  aria-expanded={!collapsed.discoveries}
                  aria-controls="recent-discoveries-body"
                  aria-label={collapsed.discoveries ? "Expand Recent discoveries" : "Collapse Recent discoveries"}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform ${collapsed.discoveries ? "-rotate-90" : ""}`}
                    aria-hidden="true"
                  />
                </button>
              </div>
              {!collapsed.discoveries && (
                <div id="recent-discoveries-body">

              {(() => {
                const entries = timeline.data?.pages.flatMap((p) => p.items) ?? [];
                if (entries.length === 0) {
                  return (
                    <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
                      Every fact you reveal shows up here.
                    </p>
                  );
                }
                return (
                  <>
                    <ol className="space-y-2">
                      {entries.map((entry, i) => (
                        <motion.li
                          key={`${entry.fact.id}-${i}`}
                          initial={{ opacity: 0, x: -4 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: Math.min(i, 10) * 0.02 }}
                          className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                        >
                          <span className="mt-0.5 text-base">{emojiFor(entry.fact.category)}</span>
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm text-white/90">{entry.fact.question}</div>
                            <div className="text-[10px] text-white/40">
                              {new Date(entry.seen_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </div>
                          </div>
                        </motion.li>
                      ))}
                    </ol>
                    {timeline.hasNextPage && (
                      <button
                        type="button"
                        onClick={() => timeline.fetchNextPage()}
                        disabled={timeline.isFetchingNextPage}
                        className="mt-3 w-full rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-white/80"
                      >
                        {timeline.isFetchingNextPage ? "Loading…" : "Load more history"}
                      </button>
                    )}
                  </>
                );
              })()}
                </div>
              )}
            </section>

          );

          return sectionOrder === "achievements-first"
            ? [achievementsSection, discoveriesSection]
            : [discoveriesSection, achievementsSection];
        })()}

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            to="/settings"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white/90"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function CollapseChevron({ collapsed, onToggle, label }: { collapsed: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={`${collapsed ? "Expand" : "Collapse"} ${label}`}
      className="glass grid h-8 w-8 place-items-center rounded-full border border-white/10 text-white/70 transition hover:text-white"
    >
      <ChevronDown className={`h-4 w-4 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
    </button>
  );
}

function CollapsibleWrap({ collapsed, onToggle, label, children }: { collapsed: boolean; onToggle: () => void; label: string; children: React.ReactNode }) {
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</span>
        <CollapseChevron collapsed={collapsed} onToggle={onToggle} label={label} />
      </div>
      {!collapsed && children}
    </div>
  );
}



function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass rounded-3xl border border-white/10 p-4">
      <div className="flex items-center gap-2">{icon}<span className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</span></div>
      <div className="mt-1 font-display text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function AchievementTile({ a }: { a: Achievement }) {
  const unlocked = !!a.unlocked_at;
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className={`relative rounded-2xl border p-3 text-center text-xs ${
        unlocked
          ? "border-amber-300/30 bg-amber-400/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/40"
      }`}
    >
      <div className={`text-3xl ${unlocked ? "" : "grayscale opacity-40"}`}>{a.emoji}</div>
      <div className="mt-1 font-black leading-tight">{a.name}</div>
      <div className="mt-1 text-[10px] font-medium text-white/50 leading-tight">{a.description}</div>
    </motion.div>
  );
}

function QuizStatsSection() {
  const fetchQuiz = useServerFn(getMyQuizStats);
  const q = useQuery({ queryKey: ["quiz-stats"], queryFn: () => fetchQuiz() });
  if (!q.data) return null;
  const s = q.data;
  const hasPlayed = s.questions_answered > 0;
  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-black text-white">
          <Trophy className="h-5 w-5 text-amber-300" /> Quiz stats
        </h2>
        <Link to="/leaderboard" className="text-xs font-bold text-fuchsia-200">Leaderboard →</Link>
      </header>
      {!hasPlayed ? (
        <Link
          to="/quiz"
          className="glass-strong flex items-center gap-3 rounded-3xl p-4 active:scale-[0.99]"
        >
          <span className="text-3xl">🏆</span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-white">Take your first quiz</div>
            <div className="text-xs text-white/60">Score points, unlock badges, top the leaderboard.</div>
          </div>
          <ArrowRight className="h-4 w-4 text-white/60" />
        </Link>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <StatTile icon={<Trophy className="h-5 w-5 text-amber-300" />} label="Total score" value={s.total_score} />
          <StatTile icon={<Zap className="h-5 w-5 text-yellow-300" />} label="Best quiz" value={s.best_score} />
          <StatTile icon={<Sparkles className="h-5 w-5 text-fuchsia-300" />} label="Questions" value={s.questions_answered} />
          <StatTile icon={<Check className="h-5 w-5 text-emerald-300" />} label="Accuracy" value={`${s.accuracy}%`} />
          <StatTile icon={<Flame className="h-5 w-5 text-orange-400" />} label="Best streak" value={s.best_streak} />
          <StatTile icon={<span className="text-lg">{emojiFor(s.favorite_category)}</span>} label="Top theme" value={s.favorite_category ?? "—"} />
        </div>
      )}
    </section>
  );
}

function MyRankingsSection() {
  const fetchRankings = useServerFn(getMyRankings);
  const q = useQuery({ queryKey: ["my-rankings"], queryFn: () => fetchRankings() });
  if (!q.data || q.data.length === 0) return null;
  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-black text-white">
          <Trophy className="h-5 w-5 text-amber-300" /> Your Curiosity Rankings
        </h2>
        <Link to="/leaderboard" className="text-xs font-bold text-fuchsia-200">Arena →</Link>
      </header>
      <ul className="space-y-2">
        {q.data.map((r) => (
          <motion.li
            key={r.key}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong flex items-center gap-3 rounded-2xl border border-white/10 p-3"
          >
            <span className="text-2xl leading-none">{r.emoji}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-black text-white">{r.label}</p>
              <p className="truncate text-[11px] text-white/60">{r.message}</p>
            </div>
            <div className="text-right">
              <p className="text-lg font-black text-white">
                {r.rank ? `#${r.rank.toLocaleString()}` : "—"}
              </p>
              {r.percentile !== null && r.percentile <= 25 && (
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-200">Top {r.percentile}%</p>
              )}
            </div>
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

