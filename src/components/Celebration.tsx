import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo } from "react";
import starImg from "@/assets/star-celebrate.png";

type Props = {
  open: boolean;
  points: number;
  streak: number;
  onClose: () => void;
};

export function Celebration({ open, points, streak, onClose }: Props) {
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(onClose, 2600);
    return () => clearTimeout(t);
  }, [open, onClose]);

  const confetti = useMemo(
    () =>
      Array.from({ length: 26 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 340,
        y: (Math.random() - 0.5) * 400 - 60,
        rot: Math.random() * 720,
        color: ["#a855f7", "#22d3ee", "#f59e0b", "#ec4899", "#34d399"][i % 5],
        delay: Math.random() * 0.15,
      })),
    [open],
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          {confetti.map((c) => (
            <motion.div
              key={c.id}
              className="absolute h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: c.color }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{ x: c.x, y: c.y, opacity: [0, 1, 1, 0], rotate: c.rot }}
              transition={{ duration: 1.8, delay: c.delay, ease: "easeOut" }}
            />
          ))}
          <motion.div
            className="glass-strong relative z-10 flex w-full max-w-xs flex-col items-center rounded-4xl p-6 text-center"
            initial={{ scale: 0.5, y: 40 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.img
              src={starImg}
              alt=""
              className="h-40 w-40 drop-shadow-[0_10px_40px_rgba(250,204,21,0.6)]"
              animate={{ rotate: [0, -8, 8, 0] }}
              transition={{ duration: 0.9, ease: "easeInOut" }}
            />
            <p className="mt-2 text-2xl font-black text-gradient font-display">Awesome!</p>
            <p className="mt-1 text-sm text-white/80">You earned</p>
            <p className="mt-1 text-4xl font-black text-white">+{points} pts</p>
            {streak > 1 && (
              <div className="mt-4 rounded-full bg-white/10 px-4 py-1.5 text-sm font-bold text-orange-300">
                🔥 {streak}-day streak
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
