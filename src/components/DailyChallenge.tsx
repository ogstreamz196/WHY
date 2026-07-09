import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Check, Flame, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CoinIcon } from "@/components/CoinIcon";
import { newlyReachedMilestone, type StreakMilestone } from "@/components/StreakBadges";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { analytics } from "@/lib/analytics";

import { useCallback, useEffect, useState } from "react";
import { getDailyChallengeMCQ, type DailyMCQ } from "@/lib/facts.functions";
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
 * Daily Challenge — shows a "quick fact" teaser, then a multiple-choice
 * question. Awards +25 curiosity points and advances the streak the first
 * time the user answers correctly. Wrong answers can be retried, but only
 * the first correct answer counts.
 */
export function DailyChallenge({ onCompleted }: Props) {
  const fetchMCQ = useServerFn(getDailyChallengeMCQ);
  const [mcq, setMCQ] = useState<DailyMCQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"teaser" | "quiz" | "result">("teaser");
  const [picked, setPicked] = useState<number | null>(null);
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
        const m = await fetchMCQ();
        if (!cancelled) setMCQ(m);
      } catch (e) {
        console.warn("daily mcq failed", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fetchMCQ]);

  const fact = mcq?.fact ?? null;

  const answer = useCallback(
    (idx: number) => {
      if (!mcq || picked !== null) return;
      setPicked(idx);
      const isCorrect = idx === mcq.correctIndex;
      if (!isCorrect) {
        setTimeout(() => setPicked(null), 900);
        return;
      }
      setPhase("result");
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
          analytics.streakMilestoneUnlocked(milestone.days, milestone.label, "daily_challenge");
          setMilestoneBurst(milestone);
        }
        window.setTimeout(() => setAwardedFlash(null), 3200);
      }
    },
    [mcq, picked, onCompleted],
  );

  const gradient = gradientFor(fact?.category);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-3"
      aria-labelledby="daily-challenge-title"
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
              aria-hidden
              className="inline-flex h-8 w-8 items-center justify-center rounded-xl text-base shadow"
              style={{ background: gradient }}
            >
              <Calendar className="h-4 w-4 text-white" />
            </span>
            <div className="leading-tight">
              <h2 id="daily-challenge-title" className="text-[10px] font-black uppercase tracking-widest text-white/60">
                Daily Challenge
              </h2>
              <p className="text-xs font-bold text-white/90">
                {done ? "Streak locked in ✓" : "Quick fact + 1 question · +25 pts"}
              </p>
            </div>

          </div>
          {done && (
            <button
              type="button"
              onClick={() => setCollapsed((v) => !v)}
              aria-expanded={!collapsed}
              aria-controls="daily-challenge-body"
              className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            >
              {collapsed ? "Show" : "Hide"}
            </button>
          )}
        </header>


        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              key="body"
              id="daily-challenge-body"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >

              <div className="mt-3">
                {loading ? (
                  <div className="h-24 animate-pulse rounded-2xl bg-white/5" />
                ) : !mcq || !fact ? (
                  <p className="text-sm text-white/70">
                    No facts in the library yet — tap NEW FACT below to start!
                  </p>
                ) : phase === "teaser" ? (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      ⚡ Quick fact
                    </p>
                    <h2 className="mt-1 font-display text-lg font-black leading-tight text-white">
                      {capitalize(fact.question)}{" "}
                      <span aria-hidden>{emojiFor(fact.category)}</span>
                    </h2>
                    {fact.fun_fact && (
                      <p className="mt-2 text-xs italic text-yellow-200/90">
                        ⭐ {fact.fun_fact}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => setPhase("quiz")}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white active:scale-[0.98]"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Sparkles className="h-4 w-4" />
                      {done ? "Replay the question" : "Take the challenge"}
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                      🤔 Pick the real reason
                    </p>
                    <h2 className="mt-1 font-display text-base font-black leading-tight text-white">
                      {capitalize(fact.question)}
                    </h2>
                    <div className="mt-3 grid gap-2" role="group" aria-label="Answer choices">
                      {mcq.choices.map((choice, i) => {
                        const isPicked = picked === i;
                        const isCorrect = i === mcq.correctIndex;
                        const showCorrect = picked !== null && isCorrect;
                        const showWrong = isPicked && !isCorrect;
                        const letter = String.fromCharCode(65 + i);
                        const status = showCorrect ? " (correct)" : showWrong ? " (incorrect)" : "";
                        return (
                          <button
                            key={i}
                            type="button"
                            disabled={picked !== null && (picked === mcq.correctIndex)}
                            onClick={() => answer(i)}
                            aria-label={`Option ${letter}: ${choice}${status}`}
                            aria-pressed={isPicked}
                            className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
                              showCorrect
                                ? "border-emerald-400/60 bg-emerald-400/15 text-emerald-100"
                                : showWrong
                                  ? "border-rose-400/60 bg-rose-400/15 text-rose-100"
                                  : "border-white/10 bg-white/[0.04] text-white/90 hover:bg-white/[0.08]"
                            }`}
                          >
                            <span aria-hidden className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/15 bg-white/5 text-[10px] font-black">
                              {showCorrect ? (
                                <Check className="h-3.5 w-3.5" />
                              ) : showWrong ? (
                                <X className="h-3.5 w-3.5" />
                              ) : (
                                letter
                              )}
                            </span>
                            <span className="flex-1">{choice}</span>
                          </button>
                        );
                      })}
                    </div>

                    {phase === "result" && (
                      <motion.div
                        role="status"
                        aria-live="polite"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3"
                      >
                        <p className="text-[10px] font-black uppercase tracking-widest text-emerald-300">
                          The full story
                        </p>
                        <p className="mt-1 text-sm leading-relaxed text-white/95">
                          {fact.answer}
                        </p>
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
              role="status"
              aria-live="polite"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mt-3 flex items-center justify-center gap-3 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 px-3 py-2 text-xs font-black text-yellow-100"
            >
              <span className="inline-flex items-center gap-1">
                <CoinIcon size={16} aria-hidden />
                +{awardedFlash.delta} coins
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-300" aria-hidden />
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
