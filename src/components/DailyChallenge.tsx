import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { BookOpen, Calendar, Check, Flame, Gift, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { CoinIcon } from "@/components/CoinIcon";
import { AnswerSummary } from "@/components/AnswerSummary";
import { FeedbackToggles } from "@/components/FeedbackToggles";
import { feedback } from "@/lib/feedback";
import { newlyReachedMilestone, type StreakMilestone } from "@/components/StreakBadges";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { analytics } from "@/lib/analytics";

import { useCallback, useEffect, useRef, useState } from "react";
import { getDailyChallengeMCQ, type DailyMCQ } from "@/lib/facts.functions";
import { completeDailyChallenge, hasCompletedDailyChallenge } from "@/lib/store";
import { emojiFor, gradientFor } from "@/lib/categories";
import { asWhyQuestion } from "@/lib/whyQuestion";
import { RewardReveal, type RevealPrize } from "@/components/RewardReveal";
import { useDressUp, useMyAvatar } from "@/hooks/useMyAvatar";
import type { DailyReward } from "@/lib/avatarItems";
import { itemById } from "@/lib/store";
import { readingTimeMs } from "@/lib/readingTime";

/** What the server says about a signed-in player's win. */
export type DailyWin = {
  awarded: boolean;
  streak: number;
  pointsDelta: number;
  reward?: DailyReward | null;
};

type Props = {
  userId?: string | null;
  /**
   * Guests: records the win (already counted on this device) and returns the
   * mystery reward the player won, if any.
   */
  onCompleted?: (result: {
    streak: number;
    points: number;
    pointsDelta: number;
  }) => Promise<DailyReward | null | undefined> | void;
  /**
   * Signed in: whether the account already did today's challenge (null while
   * unknown). The account decides, not this device, so another device or a
   * guest on a shared device can't change it.
   */
  doneToday?: boolean | null;
  /** Signed in: records the win on the server. Null if it couldn't be saved. */
  recordWin?: () => Promise<DailyWin | null>;
};

/**
 * Daily Challenge — the player reads today's fact (with time to read it
 * properly), then answers a multiple-choice question about it. The first
 * correct answer of the day awards +25 coins, advances the streak and opens a
 * free mystery reward. Wrong answers can be retried and there's no timer.
 */
export function DailyChallenge({ onCompleted, userId = null, doneToday, recordWin }: Props) {
  const signedIn = !!userId && !!recordWin;
  const fetchMCQ = useServerFn(getDailyChallengeMCQ);
  const [mcq, setMCQ] = useState<DailyMCQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [phase, setPhase] = useState<"teaser" | "quiz" | "result">("teaser");
  const [readReady, setReadReady] = useState(false);
  const [wrongTries, setWrongTries] = useState(0);
  const [reward, setReward] = useState<RevealPrize | null>(null);
  const [revealOpen, setRevealOpen] = useState(false);
  const myAvatar = useMyAvatar(userId);
  const dressUp = useDressUp(userId);
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [awardedFlash, setAwardedFlash] = useState<null | {
    streak: number;
    delta: number;
  }>(null);
  const [milestoneBurst, setMilestoneBurst] = useState<StreakMilestone | null>(null);
  const [pointsAwarded, setPointsAwarded] = useState(0);
  const [focusIdx, setFocusIdx] = useState(0);
  const choiceRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // Load once. (Re-running this after the player answers would fold the card
  // away mid-celebration, because by then today's challenge counts as done.)
  const fetchRef = useRef(fetchMCQ);
  useEffect(() => {
    const fetchMCQ = fetchRef.current;
    let cancelled = false;
    if (!signedIn) {
      const alreadyDone = hasCompletedDailyChallenge();
      setDone(alreadyDone);
      setCollapsed(alreadyDone);
    }
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Signed in: follow the account's answer once it arrives, but never fold the
  // card away after the player has just answered.
  const answeredRef = useRef(false);
  useEffect(() => {
    if (!signedIn || doneToday == null || answeredRef.current) return;
    setDone(doneToday);
    setCollapsed(doneToday);
  }, [signedIn, doneToday]);

  const fact = mcq?.fact ?? null;

  // Give a reading pause before the question unlocks (no pressure: it's the
  // question that waits, never the player).
  const readMs = fact ? readingTimeMs(`${fact.question} ${fact.answer} ${fact.fun_fact ?? ""}`) : 0;
  useEffect(() => {
    if (!fact || phase !== "teaser") return;
    if (done) {
      setReadReady(true);
      return;
    }
    setReadReady(false);
    const t = setTimeout(() => setReadReady(true), readMs);
    return () => clearTimeout(t);
  }, [fact, phase, done, readMs]);

  const answer = useCallback(
    (idx: number) => {
      if (!mcq || picked !== null) return;
      setPicked(idx);
      const isCorrect = idx === mcq.correctIndex;
      if (!isCorrect) {
        feedback("wrong");
        setWrongTries((n) => n + 1);
        setTimeout(() => setPicked(null), 900);
        return;
      }
      feedback("correct");
      setPhase("result");
      answeredRef.current = true;

      const celebrate = (streak: number, delta: number) => {
        setDone(true);
        setPointsAwarded(delta);
        setAwardedFlash({ streak, delta });
        const milestone = newlyReachedMilestone(streak);
        if (milestone) {
          toast.success(
            `${milestone.emoji} ${milestone.label} unlocked! ${milestone.days}-day streak!`,
            { duration: 5000, className: "font-bold" },
          );
          analytics.streakMilestoneUnlocked(milestone.days, milestone.label, "daily_challenge");
          setMilestoneBurst(milestone);
          // Tell the global watcher this one is already celebrated, so it
          // doesn't show the same milestone a second time.
          try {
            sessionStorage.setItem("why:seenStreakMilestone", String(milestone.days));
          } catch {
            /* ignore */
          }
        }
        window.setTimeout(() => setAwardedFlash(null), 3200);
      };
      const showReward = (r: DailyReward | null | undefined | void) => {
        if (!r) return;
        if (r.kind === "coins") setReward({ kind: "coins", amount: r.amount });
        else {
          const item = itemById(r.itemId);
          if (item) setReward({ kind: "item", item });
        }
      };

      if (signedIn && recordWin) {
        // The server decides the coins, the streak and the reward.
        recordWin()
          .then((win) => {
            if (!win) {
              toast.error("Couldn't save your answer. Please try again.");
              answeredRef.current = false;
              setPicked(null);
              setPhase("quiz");
              return;
            }
            if (!win.awarded) {
              setDone(true);
              toast("You've already done today's challenge. Come back tomorrow!");
              return;
            }
            celebrate(win.streak, win.pointsDelta);
            showReward(win.reward);
          })
          .catch((e) => console.warn("daily challenge failed", e));
        return;
      }

      const result = completeDailyChallenge();
      if (result.awarded) {
        celebrate(result.streak, result.pointsDelta);
        Promise.resolve(
          onCompleted?.({
            streak: result.streak,
            points: result.points,
            pointsDelta: result.pointsDelta,
          }),
        )
          .then(showReward)
          .catch((e) => console.warn("daily reward failed", e));
      }
    },
    [mcq, picked, onCompleted, signedIn, recordWin],
  );

  const handleChoiceKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, i: number) => {
      if (!mcq) return;
      const n = mcq.choices.length;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const next = (i + 1) % n;
        setFocusIdx(next);
        choiceRefs.current[next]?.focus();
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (i - 1 + n) % n;
        setFocusIdx(prev);
        choiceRefs.current[prev]?.focus();
      } else if (e.key === "Home") {
        e.preventDefault();
        setFocusIdx(0);
        choiceRefs.current[0]?.focus();
      } else if (e.key === "End") {
        e.preventDefault();
        setFocusIdx(n - 1);
        choiceRefs.current[n - 1]?.focus();
      }
    },
    [mcq],
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
              <h2
                id="daily-challenge-title"
                className="text-[10px] font-black uppercase tracking-widest text-white/60"
              >
                Daily Challenge
              </h2>
              <p className="text-xs font-bold text-white/90">
                {done ? "Streak locked in ✓" : "Read, answer, win a mystery reward 🎁"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <FeedbackToggles />
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
          </div>
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
                    <p className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-white/50">
                      <BookOpen className="h-3.5 w-3.5" aria-hidden /> Read this first, the question
                      is about it
                    </p>
                    <h3 className="mt-1 font-fun text-[clamp(1.15rem,3vw,1.5rem)] font-bold leading-snug text-white">
                      {asWhyQuestion(fact.question)}{" "}
                      <span aria-hidden>{emojiFor(fact.category)}</span>
                    </h3>
                    <motion.p
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 }}
                      className="mt-2 font-fun text-[clamp(1rem,2.5vw,1.2rem)] leading-relaxed text-white/90"
                    >
                      {fact.answer}
                    </motion.p>

                    {fact.fun_fact && (
                      <p className="mt-2 font-fun text-[clamp(0.95rem,2.4vw,1.15rem)] italic text-yellow-100">
                        ⭐ {fact.fun_fact}
                      </p>
                    )}
                    <div className="relative mt-4 overflow-hidden rounded-full">
                      {!readReady && (
                        <motion.span
                          aria-hidden
                          className="absolute inset-y-0 left-0 bg-white/15"
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ duration: readMs / 1000, ease: "linear" }}
                        />
                      )}
                      <motion.button
                        type="button"
                        disabled={!readReady}
                        onClick={() => {
                          feedback("reveal");
                          setPhase("quiz");
                        }}
                        animate={readReady && !done ? { scale: [1, 1.03, 1] } : undefined}
                        transition={{ duration: 1.4, repeat: Infinity }}
                        className="relative inline-flex w-full items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-black text-white transition-opacity disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80"
                        style={{
                          background: readReady
                            ? "var(--gradient-primary)"
                            : "rgba(255,255,255,0.08)",
                        }}
                      >
                        {readReady ? (
                          <>
                            <Sparkles className="h-4 w-4" aria-hidden />
                            {done ? "Replay the question" : "I've read it, quiz me!"}
                          </>
                        ) : (
                          <>📖 Take your time reading…</>
                        )}
                      </motion.button>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
                        🤔 Pick the real reason
                      </p>
                      {phase === "quiz" && (
                        <button
                          type="button"
                          onClick={() => setPhase("teaser")}
                          className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-white/70"
                        >
                          📖 Read again
                        </button>
                      )}
                    </div>
                    <h3 className="mt-1 font-fun text-[clamp(1.1rem,2.9vw,1.4rem)] font-bold leading-snug text-white">
                      {asWhyQuestion(fact.question)}
                    </h3>

                    <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Answer choices">
                      {mcq.choices.map((choice, i) => {
                        const isPicked = picked === i;
                        const isCorrect = i === mcq.correctIndex;
                        const showCorrect = picked !== null && isCorrect;
                        const showWrong = isPicked && !isCorrect;
                        const letter = String.fromCharCode(65 + i);
                        const status = showCorrect ? " (correct)" : showWrong ? " (incorrect)" : "";
                        const isTabStop = focusIdx === i;
                        return (
                          <motion.button
                            key={i}
                            ref={(el) => {
                              choiceRefs.current[i] = el;
                            }}
                            type="button"
                            role="radio"
                            aria-checked={isPicked}
                            tabIndex={isTabStop ? 0 : -1}
                            disabled={picked !== null && picked === mcq.correctIndex}
                            onClick={() => {
                              setFocusIdx(i);
                              answer(i);
                            }}
                            onFocus={() => setFocusIdx(i)}
                            onKeyDown={(e) => handleChoiceKey(e, i)}
                            aria-label={`Option ${letter}: ${choice}${status}`}
                            initial={{ opacity: 0, y: 12, scale: 0.96 }}
                            animate={
                              showWrong
                                ? { opacity: 1, y: 0, scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }
                                : showCorrect
                                  ? { opacity: 1, y: 0, scale: [1, 1.06, 1] }
                                  : { opacity: 1, y: 0, scale: 1 }
                            }
                            transition={{
                              delay: picked === null ? i * 0.06 : 0,
                              duration: showWrong ? 0.5 : showCorrect ? 0.45 : 0.25,
                            }}
                            whileHover={picked === null ? { scale: 1.02, y: -2 } : undefined}
                            whileTap={picked === null ? { scale: 0.97 } : undefined}
                            className={`group relative flex min-h-[56px] items-center gap-3 overflow-hidden rounded-2xl border-2 px-4 py-4 text-left font-fun text-[clamp(1rem,2.6vw,1.2rem)] font-semibold leading-snug transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${
                              showCorrect
                                ? "border-emerald-400 bg-gradient-to-br from-emerald-400/25 to-emerald-500/10 text-emerald-50 shadow-[0_0_24px_rgba(52,211,153,0.35)]"
                                : showWrong
                                  ? "border-rose-400 bg-gradient-to-br from-rose-400/25 to-rose-500/10 text-rose-50"
                                  : "border-white/10 bg-white/[0.06] text-white hover:border-white/30 hover:bg-white/[0.12] active:bg-white/[0.16]"
                            }`}
                          >
                            {showCorrect && (
                              <motion.span
                                aria-hidden
                                className="pointer-events-none absolute inset-0"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: [0, 0.7, 0] }}
                                transition={{ duration: 0.9 }}
                                style={{
                                  background:
                                    "radial-gradient(circle at 30% 50%, rgba(16,185,129,0.45), transparent 60%)",
                                }}
                              />
                            )}
                            <motion.span
                              aria-hidden
                              className={`relative inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-sm font-black shadow-sm ${
                                showCorrect
                                  ? "border-emerald-300 bg-emerald-400 text-emerald-950"
                                  : showWrong
                                    ? "border-rose-300 bg-rose-400 text-rose-950"
                                    : "border-white/20 bg-white/10 text-white group-hover:border-white/40 group-hover:bg-white/20"
                              }`}
                              animate={showCorrect ? { rotate: [0, -12, 12, 0] } : undefined}
                              transition={{ duration: 0.5 }}
                            >
                              {showCorrect ? (
                                <Check className="h-5 w-5" strokeWidth={3} />
                              ) : showWrong ? (
                                <X className="h-5 w-5" strokeWidth={3} />
                              ) : (
                                letter
                              )}
                            </motion.span>
                            <span className="relative flex-1">{choice}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {phase === "quiz" && wrongTries > 0 && (
                      <motion.p
                        key={wrongTries}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 text-center text-sm font-bold text-white/80"
                        role="status"
                      >
                        {
                          [
                            "Not quite! Have another go 💪",
                            "So close! Try a different one 🤔",
                            "Tip: tap 📖 Read again to peek at the fact",
                          ][Math.min(wrongTries - 1, 2)]
                        }
                      </motion.p>
                    )}

                    {phase === "result" && reward && (
                      <motion.button
                        type="button"
                        onClick={() => setRevealOpen(true)}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: [1, 1.05, 1], rotate: [0, -2, 2, 0] }}
                        transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-amber-300/50 bg-gradient-to-r from-amber-400/30 via-pink-500/25 to-violet-500/30 px-4 py-3 text-sm font-black text-white shadow-[0_0_28px_rgba(251,191,36,0.35)]"
                      >
                        <Gift className="h-5 w-5 text-amber-200" aria-hidden />
                        Open your mystery reward!
                      </motion.button>
                    )}

                    <AnimatePresence>
                      {phase === "result" && (
                        <AnswerSummary
                          correct
                          explanation={fact.answer}
                          funFact={fact.fun_fact}
                          points={pointsAwarded}
                          scoreBefore={0}
                          scoreAfter={pointsAwarded}
                          streak={awardedFlash?.streak}
                          actionLabel="Nice — keep exploring"
                          autoFocusAction={false}
                        />
                      )}
                    </AnimatePresence>
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
                <CoinIcon size={16} aria-hidden />+{awardedFlash.delta} coins
              </span>
              <span className="inline-flex items-center gap-1">
                <Flame className="h-4 w-4 text-orange-300" aria-hidden />
                {awardedFlash.streak}-day streak!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </article>
      <RewardReveal
        prize={revealOpen ? reward : null}
        title="Daily Challenge reward"
        avatar={myAvatar}
        onWear={async (item) => {
          try {
            await dressUp(item);
            toast.success(`${item.emoji} ${item.name} on!`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't put that on");
          }
        }}
        onClose={() => {
          setRevealOpen(false);
          setReward(null);
        }}
      />
      <StreakMilestoneCelebration
        milestone={milestoneBurst}
        source="daily_challenge"
        onClose={() => setMilestoneBurst(null)}
      />
    </motion.section>
  );
}
