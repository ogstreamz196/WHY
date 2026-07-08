import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Crown, Trophy, Users } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { useCurrentUser } from "@/lib/auth";
import {
  getGlobalLeaderboard,
  getWeeklyLeaderboard,
  type LeaderboardEntry,
} from "@/lib/quiz.functions";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard — Why?" },
      { name: "description", content: "Who's the most curious this week?" },
    ],
  }),
  component: LeaderboardPage,
});

type Tab = "global" | "weekly" | "friends";

function LeaderboardPage() {
  const { user } = useCurrentUser();
  const fetchGlobal = useServerFn(getGlobalLeaderboard);
  const fetchWeekly = useServerFn(getWeeklyLeaderboard);
  const [tab, setTab] = useState<Tab>("weekly");
  const [rows, setRows] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (tab === "friends") { setRows([]); setLoading(false); return; }
    setLoading(true);
    const fn = tab === "global" ? fetchGlobal : fetchWeekly;
    fn({ data: { limit: 50 } })
      .then((r) => setRows(r))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [tab, fetchGlobal, fetchWeekly]);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link to="/quiz" className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-white/90">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-black text-white">Leaderboard</h1>
            <p className="text-xs text-white/60">Compete with the curious minds worldwide.</p>
          </div>
        </header>

        <div className="glass-strong mb-3 flex rounded-2xl p-1">
          {(["weekly", "global", "friends"] as Tab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex flex-1 items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition ${
                tab === t ? "text-white shadow-[var(--shadow-glow)]" : "text-white/50"
              }`}
              style={tab === t ? { background: "var(--gradient-primary)" } : undefined}
            >
              {t === "global" && <Trophy className="h-3.5 w-3.5" />}
              {t === "weekly" && <Crown className="h-3.5 w-3.5" />}
              {t === "friends" && <Users className="h-3.5 w-3.5" />}
              {t}
            </button>
          ))}
        </div>

        {tab === "friends" ? (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <Users className="mx-auto h-10 w-10 text-white/40" />
            <p className="mt-2 font-display text-lg font-black text-white">Friends coming soon</p>
            <p className="mt-1 text-sm text-white/60">
              Follow other curious minds and race them to the top.
            </p>
          </div>
        ) : loading ? (
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-2xl bg-white/5" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="glass-strong rounded-3xl p-8 text-center">
            <p className="text-sm text-white/70">Nobody's on the board yet. Be the first!</p>
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
            {rows.map((r, i) => {
              const me = r.user_id === user?.id;
              const score = tab === "weekly" ? r.week_score ?? 0 : r.quiz_score ?? 0;
              return (
                <motion.li
                  key={r.user_id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className={`flex items-center gap-3 rounded-2xl border p-3 ${
                    me
                      ? "border-fuchsia-300/40 bg-fuchsia-500/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-black ${
                      i === 0
                        ? "bg-amber-400/20 text-amber-200"
                        : i === 1
                          ? "bg-slate-300/20 text-slate-100"
                          : i === 2
                            ? "bg-orange-400/20 text-orange-200"
                            : "bg-white/5 text-white/70"
                    }`}
                  >
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-black text-white">
                      {r.display_name || r.username || "Explorer"}
                      {me && <span className="ml-1 text-[10px] font-black text-fuchsia-300">YOU</span>}
                    </p>
                    {tab === "global" && (
                      <p className="text-[11px] text-white/50">Best {r.best_score ?? 0} · {r.questions_answered ?? 0} Qs</p>
                    )}
                    {tab === "weekly" && (
                      <p className="text-[11px] text-white/50">{r.quizzes_played ?? 0} quizzes · best {r.best_this_week ?? 0}</p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black text-white">{score.toLocaleString()}</p>
                    <p className="text-[9px] font-black uppercase tracking-widest text-white/40">pts</p>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
