import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Share2, Sparkles } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useCurrentUser } from "@/lib/auth";
import { getWeeklyRecap, type WeeklyRecap } from "@/lib/missions.functions";
import { emojiFor } from "@/lib/categories";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recap")({
  head: () => ({
    meta: [
      { title: "Your curiosity week — Why?" },
      { name: "description", content: "A weekly report of your curiosity journey." },
    ],
  }),
  component: RecapPage,
});

function RecapPage() {
  const { user } = useCurrentUser();
  const fetchRecap = useServerFn(getWeeklyRecap);
  const [recap, setRecap] = useState<WeeklyRecap | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    fetchRecap()
      .then((r) => {
        if (cancelled) return;
        setRecap(r);
        setLoading(false);
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user, fetchRecap, attempt]);

  const share = async () => {
    if (!recap) return;
    const text = `📚 My curiosity week:\n\n✨ ${recap.discoveries} discoveries\n🔥 ${recap.current_streak}-day streak\n🏅 ${recap.new_achievements.length} new badges\n\n${recap.insight}`;
    try {
      if (navigator.share) await navigator.share({ title: "My curiosity week", text });
      else {
        await navigator.clipboard.writeText(text);
        toast.success("Copied to clipboard");
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <main className="relative min-h-[100dvh] pb-24">
      <CosmicBackground />
      <div className="mx-auto w-full max-w-md px-4 pt-6">
        <div className="mb-4 flex items-center gap-2">
          <Link
            to="/profile"
            className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="font-display text-lg font-black text-white">Your curiosity week</h1>
          <button
            type="button"
            onClick={share}
            disabled={!recap}
            className="ml-auto rounded-full border border-white/10 bg-white/5 p-2 text-white/70 transition hover:bg-white/10 disabled:opacity-40"
          >
            <Share2 className="h-4 w-4" />
          </button>
        </div>

        {failed && !recap ? (
          <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-6 text-center">
            <div className="text-3xl">😕</div>
            <p className="mt-2 text-sm font-black text-white">We couldn't load your week</p>
            <p className="mt-1 text-xs text-white/60">Check your internet and try again.</p>
            <button
              type="button"
              onClick={() => setAttempt((n) => n + 1)}
              className="mt-4 rounded-2xl px-5 py-2.5 text-sm font-black text-white shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              Try again
            </button>
          </div>
        ) : loading || !recap ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-3xl bg-white/5" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            <Card
              delay={0}
              className="bg-gradient-to-br from-violet-500/15 to-fuchsia-500/15 border-violet-400/20"
            >
              <div className="text-[10px] font-black uppercase tracking-widest text-violet-200/80">
                {formatDate(recap.start)} — {formatDate(recap.end)}
              </div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-5xl font-black text-white">{recap.discoveries}</span>
                <span className="text-sm text-white/60">discoveries</span>
              </div>
              <p className="mt-2 flex items-start gap-2 text-sm text-white/80">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                {recap.insight}
              </p>
            </Card>

            <div className="grid grid-cols-2 gap-3">
              <Card delay={0.05}>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  XP earned
                </div>
                <div className="mt-1 text-3xl font-black text-white">~{recap.xp_earned_est}</div>
              </Card>
              <Card delay={0.1}>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Best streak
                </div>
                <div className="mt-1 text-3xl font-black text-white">🔥 {recap.best_streak}</div>
              </Card>
            </div>

            {recap.categories.length > 0 && (
              <Card delay={0.15}>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  Top categories
                </div>
                <div className="mt-2 space-y-2">
                  {recap.categories.map((c) => (
                    <div key={c.key}>
                      <div className="flex items-center justify-between text-xs text-white/80">
                        <span className="font-bold">
                          {emojiFor(c.key)} {c.key}
                        </span>
                        <span className="text-white/50">
                          {c.count} · {c.pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${c.pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className="h-full rounded-full bg-gradient-to-r from-violet-400 to-fuchsia-400"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {recap.new_achievements.length > 0 && (
              <Card delay={0.2}>
                <div className="text-[10px] font-black uppercase tracking-widest text-white/50">
                  New this week
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recap.new_achievements.map((a) => (
                    <span
                      key={a.id}
                      className="flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-100"
                    >
                      <span>{a.emoji}</span>
                      {a.name}
                    </span>
                  ))}
                </div>
              </Card>
            )}

            {recap.discoveries === 0 && (
              <Card delay={0.25}>
                <p className="text-center text-sm text-white/70">
                  Come back tomorrow — a new mystery is waiting for you.
                </p>
                <Link
                  to="/"
                  className="mt-3 block w-full rounded-2xl px-4 py-3 text-center text-sm font-black text-white shadow-[var(--shadow-glow)]"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Start today's mission
                </Link>
              </Card>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function Card({
  children,
  delay = 0,
  className = "",
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      className={`rounded-3xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur ${className}`}
    >
      {children}
    </motion.div>
  );
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
