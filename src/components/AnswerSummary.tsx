import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Check, Flame, Sparkles, X } from "lucide-react";
import { useEffect } from "react";

type Props = {
  correct: boolean;
  explanation?: string | null;
  funFact?: string | null;
  points?: number;
  scoreBefore?: number;
  scoreAfter?: number;
  streak?: number;
  actionLabel?: string;
  onAction?: () => void;
  autoFocusAction?: boolean;
};

/**
 * Animated per-question summary panel.
 * Shows correct/incorrect state, why the answer is right, and smoothly
 * counts up the score and streak deltas.
 */
export function AnswerSummary({
  correct,
  explanation,
  funFact,
  points = 0,
  scoreBefore = 0,
  scoreAfter = scoreBefore + points,
  streak,
  actionLabel = "Next",
  onAction,
  autoFocusAction = true,
}: Props) {
  const scoreMV = useMotionValue(scoreBefore);
  const displayScore = useTransform(scoreMV, (v) => Math.round(v).toLocaleString());

  useEffect(() => {
    scoreMV.set(scoreBefore);
    const controls = animate(scoreMV, scoreAfter, { duration: 0.9, ease: "easeOut" });
    return () => controls.stop();
  }, [scoreBefore, scoreAfter, scoreMV]);

  return (
    <motion.div
      role="status"
      aria-live="polite"
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ type: "spring", stiffness: 220, damping: 22 }}
      className={`relative mt-4 overflow-hidden rounded-2xl border p-4 ${
        correct
          ? "border-emerald-400/40 bg-gradient-to-br from-emerald-400/15 via-emerald-500/10 to-transparent"
          : "border-rose-400/40 bg-gradient-to-br from-rose-400/15 via-rose-500/10 to-transparent"
      }`}
    >
      {correct && (
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: [0, 0.5, 0] }}
          transition={{ duration: 1.1 }}
          style={{
            background:
              "radial-gradient(circle at 30% 40%, rgba(16,185,129,0.35), transparent 65%)",
          }}
        />
      )}

      <div className="relative flex items-center gap-3">
        <motion.span
          aria-hidden
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 14 }}
          className={`inline-flex h-10 w-10 items-center justify-center rounded-full border-2 ${
            correct
              ? "border-emerald-300 bg-emerald-400 text-emerald-950"
              : "border-rose-300 bg-rose-400 text-rose-950"
          }`}
        >
          {correct ? (
            <Check className="h-5 w-5" strokeWidth={3} />
          ) : (
            <X className="h-5 w-5" strokeWidth={3} />
          )}
        </motion.span>
        <div className="flex-1">
          <p className="text-sm font-black text-white">{correct ? "Nailed it!" : "Not quite"}</p>
          {(points > 0 || typeof streak === "number") && (
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-bold text-white/80">
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" aria-hidden />
                <motion.span aria-live="off">{displayScore}</motion.span>
                <span className="text-white/60">pts</span>
                {points > 0 && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="text-emerald-300"
                  >
                    +{points}
                  </motion.span>
                )}
              </span>
              {typeof streak === "number" && streak > 0 && (
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15, type: "spring", stiffness: 260 }}
                  className="inline-flex items-center gap-1 text-orange-300"
                >
                  <Flame className="h-3.5 w-3.5" aria-hidden />
                  {streak}-day streak
                </motion.span>
              )}
            </p>
          )}
        </div>
      </div>

      {explanation && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="relative mt-3 rounded-xl bg-white/[0.06] p-3"
        >
          <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
            Here's why
          </p>
          <p className="mt-1 font-fun text-[clamp(1rem,2.4vw,1.2rem)] font-medium leading-snug text-white">
            {explanation}
          </p>
        </motion.div>
      )}

      {funFact && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="relative mt-2 font-fun text-[clamp(0.9rem,2.2vw,1.05rem)] italic text-yellow-100"
        >
          ⭐ {funFact}
        </motion.p>
      )}

      {onAction && (
        <motion.button
          type="button"
          onClick={onAction}
          autoFocus={autoFocusAction}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          whileTap={{ scale: 0.98 }}
          className="relative mt-3 w-full rounded-full px-4 py-2.5 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ background: "var(--gradient-primary)" }}
        >
          {actionLabel}
        </motion.button>
      )}
    </motion.div>
  );
}
