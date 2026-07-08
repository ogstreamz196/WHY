import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import type { StreakMilestone } from "./StreakBadges";

type Props = {
  milestone: StreakMilestone | null;
  onClose: () => void;
};

/** Full-screen confetti burst when a streak milestone is reached. */
export function StreakMilestoneCelebration({ milestone, onClose }: Props) {
  useEffect(() => {
    if (!milestone) return;
    const t = setTimeout(onClose, 3200);
    return () => clearTimeout(t);
  }, [milestone, onClose]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 520,
        y: (Math.random() - 0.5) * 560 - 40,
        rot: Math.random() * 720,
        color: ["#fb923c", "#f59e0b", "#ec4899", "#a855f7", "#22d3ee", "#facc15"][i % 6],
        delay: Math.random() * 0.18,
      })),
    [milestone?.days],
  );

  return (
    <AnimatePresence>
      {milestone && (
        <motion.div
          className="fixed inset-0 z-[70] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className="absolute h-3 w-3 rounded-sm"
              style={{ backgroundColor: c.color }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: [0, 1, 1, 0], rotate: c.rot }}
              transition={{ duration: 2.2, delay: c.delay, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="glass-strong relative z-10 flex w-full max-w-sm flex-col items-center rounded-4xl border border-orange-300/40 bg-gradient-to-b from-orange-500/25 to-fuchsia-600/20 p-7 text-center shadow-[0_20px_80px_-20px_rgba(251,146,60,0.6)]"
            initial={{ scale: 0.4, y: 60, rotate: -6 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
          >
            <motion.div
              className="text-7xl drop-shadow-[0_10px_40px_rgba(251,191,36,0.8)]"
              animate={{ rotate: [0, -12, 12, -6, 6, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 1.4, ease: "easeInOut" }}
            >
              {milestone.emoji}
            </motion.div>
            <p className="mt-3 text-[10px] font-black uppercase tracking-[0.3em] text-orange-200">
              Streak milestone
            </p>
            <p className="mt-1 font-display text-3xl font-black text-white">
              {milestone.label}
            </p>
            <p className="mt-1 text-lg font-black text-orange-100">
              🔥 {milestone.days}-day streak!
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-4 rounded-full bg-white/90 px-5 py-2 text-sm font-black text-orange-600 shadow"
            >
              Keep going
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
