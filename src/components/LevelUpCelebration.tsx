import { motion, AnimatePresence } from "framer-motion";

type Props = {
  open: boolean;
  level: number;
  title: string;
  onClose: () => void;
};

export function LevelUpCelebration({ open, level, title, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          className="overlay-scroll fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 16 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-sm overflow-hidden rounded-4xl border border-amber-300/30 bg-gradient-to-br from-amber-500/25 via-orange-500/20 to-fuchsia-500/25 p-6 text-center shadow-[0_0_80px_rgba(251,191,36,0.5)]"
          >
            {/* burst */}
            <div className="pointer-events-none absolute inset-0">
              {Array.from({ length: 20 }).map((_, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0.4],
                    x: Math.cos((i / 20) * Math.PI * 2) * 140,
                    y: Math.sin((i / 20) * Math.PI * 2) * 140,
                  }}
                  transition={{ duration: 1.6, delay: 0.15 + i * 0.02, ease: "easeOut" }}
                  className="absolute left-1/2 top-1/2 text-xl"
                >
                  {["✨", "⭐", "🌟", "💫"][i % 4]}
                </motion.span>
              ))}
            </div>

            <div className="relative">
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="text-xs font-black uppercase tracking-[0.3em] text-amber-200"
              >
                Level up
              </motion.p>
              <motion.div
                initial={{ scale: 0, rotate: -20 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 240, damping: 12, delay: 0.2 }}
                className="mx-auto my-4 flex h-24 w-24 items-center justify-center rounded-3xl bg-white/15 text-5xl font-black text-white shadow-[0_0_40px_rgba(255,255,255,0.3)] backdrop-blur"
              >
                {level}
              </motion.div>
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="font-display text-2xl font-black text-white"
              >
                {title}
              </motion.h2>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-1 text-sm text-white/70"
              >
                Your curiosity just unlocked a new tier.
              </motion.p>
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.65 }}
                onClick={onClose}
                className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-900 shadow-lg transition hover:scale-[1.02]"
              >
                Continue exploring
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
