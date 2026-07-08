import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Flame, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { CoinIcon } from "@/components/CoinIcon";
import { newlyReachedMilestone, type StreakMilestone } from "@/components/StreakBadges";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { analytics } from "@/lib/analytics";

import { useCallback, useEffect, useState } from "react";
import { getDailyFact, type Fact } from "@/lib/facts.functions";
import {
  completeDailyChallenge,
  hasCompletedDailyChallenge,
} from "@/lib/store";
import { emojiFor, gradientFor } from "@/lib/categories";
const capitalize = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

type Props = {
  onCompleted?: (result: { streak: number; points: number; pointsDelta: number }) => void;
};

/**
 * Daily Challenge card — one shared "fact of the day" that awards +25 curiosity
 * points and advances the user's daily streak the first time it's revealed.
 * Later reveals the same day are a no-op (already completed).
 */
export function DailyChallenge({ onCompleted }: Props) {
  const fetchDaily = useServerFn(getDailyFact);
  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [awardedFlash, setAwardedFlash] = useState<null | {
    streak: number;
    delta: number;
  }>(null);
  const [milestoneBurst, setMilestoneBurst] = useState<StreakMilestone | null>(null);

  useEffect(() => {
    let cancelled = false;
    const alreadyDone = hasCompletedDailyChallenge();
    setDone(alreadyDone);
    setCollapsed(alreadyDone);
    (async () => {
      try {
        const f = await fetchDaily();
        if (!cancelled) setFact(f);
      } catch (e) {
        console.warn("daily fact failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchDaily]);

  const reveal = useCallback(() => {
    if (revealed) return;
    setRevealed(true);
    const result = completeDailyChallenge();
    if (result.awarded) {
      setDone(true);
      setAwardedFlash({ streak: result.streak, delta: result.pointsDelta });
      onCompleted?.({
        streak: result.streak,
        points: result.points,
        pointsDelta: result.pointsDelta,
      });
      const milestone = newlyReachedMilestone(result.streak);
      if (milestone) {
        toast.success(
          `${milestone.emoji} ${milestone.label} unlocked! ${milestone.days}-day streak!`,
          { duration: 5000, className: "font-bold" },
        );
        setMilestoneBurst(milestone);
      }
      window.setTimeout(() => setAwardedFlash(null), 3200);
    }
  }, [revealed, onCompleted]);

  const gradient = gradientFor(fact?.category);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-3"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-3 -z-10 rounded-[2rem] opacity-30 blur-2xl"
        style={{ background: gradient }}
      />
      <article className="glass-strong overflow-hidden rounded-3xl border border-white/10 p-4">
        <header className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2">
            <span
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-base shadow"
              style={{ background: gradient }}
            >
              <Calendar className="h-4 w-4 text-white" />
            </span>
            <div className="leading-tight">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">
                Daily Challenge
              </p>
              <p className="text-xs font-bold text-white/90">
                {done ? "Streak locked in ✓" : "+25 pts • keep your streak alive"}
              </p>
            </div>
          </div>
          {done && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
        </header>

        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3">
                {loading ? (
                  <div className="h-16 animate-pulse rounded-2xl bg-white/5" />
                ) : !fact ? (
                  <p className="text-sm text-white/70">
                    No facts in the library yet — tap Next below to start!
                  </p>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      🤔 Do you know why…
                    </p>
                    <h2 className="mt-1 font-display text-lg font-black leading-tight text-white">
                      {capitalize(fact.question)}{" "}
                      <span aria-hidden>{emojiFor(fact.category)}</span>
                    </h2>

                    {!revealed ? (
                      <button
                        type="button"
                        onClick={reveal}
                        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
                        style={{ background: "var(--gradient-primary)" }}
                      >
                        <Sparkles className="h-4 w-4" />
                        {done ? "Reveal today's fact" : "Complete today's challenge"}
                      </button>
                    ) : (
                      <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                      >
                        <p className="text-sm leading-relaxed text-white/95">
                          {fact.answer}
                        </p>
                        {fact.fun_fact && (
                          <p className="mt-2 text-xs italic text-yellow-200/90">
                            ⭐ {fact.fun_fact}
                          </p>
                        )}
                      </motion.div>
                    )}
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {awardedFlash && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-xs font-black text-yellow-100"
            >
              <span className="inline-flex items-center gap-1">
                <CoinIcon size={16} />
                +{awardedFlash.delta} coins

              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-300" />
                {awardedFlash.streak}-day streak!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
      <StreakMilestoneCelebration
        milestone={milestoneBurst}
        source="daily_challenge"
        onClose={() => setMilestoneBurst(null)}
      />
    </motion.section>
  );
}
