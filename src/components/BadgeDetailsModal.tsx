import { AnimatePresence, motion } from "framer-motion";
import { X, Lock, Check, Sparkles, Calendar } from "lucide-react";

export type BadgeDetail = {
  id: string;
  label: string;
  emoji: string;
  unlocked: boolean;
  /** Optional description shown when no BADGE_META entry exists (e.g. server achievements). */
  description?: string | null;
  /** Optional ISO date string of when it was unlocked. */
  unlockedAt?: string | null;
  /** Optional progress towards unlocking. */
  progress?: { current: number; target: number } | null;
};

type Props = {
  badge: BadgeDetail | null;
  onClose: () => void;
};

// Per-badge unlock guidance for local (client-side) explorer badges.
const BADGE_META: Record<string, { requirement: string; examples: string[] }> = {
  curious:   { requirement: "Discover 5 facts.",         examples: ["Tap “New fact” 5 times", "Answer one daily challenge"] },
  explorer:  { requirement: "Discover 25 facts.",        examples: ["Explore a new category", "Chain 3 whys in a row"] },
  scientist: { requirement: "Discover 100 facts.",       examples: ["Read facts across every category", "Build a chain of 5"] },
  sage:      { requirement: "Discover 250 facts.",       examples: ["Return every day for a week", "Save 10 favourites"] },
  polymath:  { requirement: "Discover 500 facts.",       examples: ["Complete 30 daily challenges", "Explore every category"] },
  oracle:    { requirement: "Discover 1,000 facts.",     examples: ["Stay curious every single day", "Master the Curiosity Arena"] },

  streak3:   { requirement: "Keep a 3-day streak.",      examples: ["Complete a daily challenge 3 days in a row"] },
  streak7:   { requirement: "Keep a 7-day streak.",      examples: ["Come back every day for a week"] },
  streak14:  { requirement: "Keep a 14-day streak.",     examples: ["Two weeks of curiosity in a row"] },
  streak30:  { requirement: "Keep a 30-day streak.",     examples: ["A full month of daily wonder"] },
  streak60:  { requirement: "Keep a 60-day streak.",     examples: ["Two months of unbroken curiosity"] },
  streak100: { requirement: "Keep a 100-day streak.",    examples: ["100 days of asking Why?"] },

  points100:  { requirement: "Earn 100 Y-Coins.",        examples: ["Answer 4 daily challenges", "Win a quiz round"] },
  points500:  { requirement: "Earn 500 Y-Coins.",        examples: ["Play the Curiosity Arena", "Chain whys and win streaks"] },
  points1k:   { requirement: "Earn 1,000 Y-Coins.",      examples: ["Compete on the leaderboard", "Complete weekly missions"] },
  points5k:   { requirement: "Earn 5,000 Y-Coins.",      examples: ["Consistent daily play adds up fast"] },
  points10k:  { requirement: "Earn 10,000 Y-Coins.",     examples: ["Top the monthly leaderboard"] },
  points25k:  { requirement: "Earn 25,000 Y-Coins.",     examples: ["Become a Curiosity Champion"] },
};

function formatUnlockDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function BadgeDetailsModal({ badge, onClose }: Props) {
  const meta = badge ? BADGE_META[badge.id] : undefined;
  const requirement =
    meta?.requirement ??
    badge?.description ??
    "Keep exploring to unlock.";
  const examples = meta?.examples ?? [];

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-details-title"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 260, damping: 22 }}
            className="glass-strong relative w-full max-w-sm overflow-hidden rounded-4xl border border-white/10 p-6 text-center text-white"
          >
            <button
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full bg-white/10 p-1.5 text-white/70 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Emoji medallion */}
            <div className="relative mx-auto mb-3 flex h-28 w-28 items-center justify-center">
              {badge.unlocked && (
                <>
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.1, 0.6] }}
                    transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
                    style={{ background: "var(--gradient-primary)", filter: "blur(18px)" }}
                  />
                  {Array.from({ length: 6 }).map((_, i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute text-lg"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: Math.cos((i / 6) * Math.PI * 2) * 60,
                        y: Math.sin((i / 6) * Math.PI * 2) * 60,
                      }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.15, ease: "easeOut" }}
                    >
                      ✨
                    </motion.span>
                  ))}
                </>
              )}
              <motion.div
                initial={{ scale: 0.6, rotate: badge.unlocked ? -20 : 0 }}
                animate={
                  badge.unlocked
                    ? { scale: 1, rotate: 0 }
                    : { scale: 1, x: [0, -3, 3, -3, 3, 0] }
                }
                transition={
                  badge.unlocked
                    ? { type: "spring", stiffness: 240, damping: 12 }
                    : { duration: 0.5, repeat: Infinity, repeatDelay: 2 }
                }
                className={`relative flex h-24 w-24 items-center justify-center rounded-3xl text-5xl shadow-2xl ${
                  badge.unlocked ? "" : "grayscale"
                }`}
                style={{
                  background: badge.unlocked
                    ? "var(--gradient-primary)"
                    : "oklch(0.25 0.02 285)",
                }}
              >
                {badge.emoji}
                {!badge.unlocked && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-black/70 p-1.5">
                    <Lock className="h-3.5 w-3.5 text-white/80" />
                  </span>
                )}
              </motion.div>
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/50">
              {badge.unlocked ? "Unlocked" : "Locked"}
            </p>
            <h3 id="badge-details-title" className="mt-1 font-display text-2xl font-black">
              {badge.label}
            </h3>

            {badge.unlocked && badge.unlockedAt && (
              <p className="mt-1 inline-flex items-center gap-1 text-xs text-white/60">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                Unlocked {formatUnlockDate(badge.unlockedAt)}
              </p>
            )}

            <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/50">
                <Sparkles className="h-3 w-3" /> Requirement
              </div>
              <p className="mt-1 text-sm text-white/90">{requirement}</p>
            </div>

            {!badge.unlocked && badge.progress && badge.progress.target > 0 && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left">
                <div className="mb-1 flex items-center justify-between text-[11px] font-black uppercase tracking-widest text-white/50">
                  <span>Progress</span>
                  <span className="text-white/80">
                    {Math.min(badge.progress.current, badge.progress.target).toLocaleString()} /{" "}
                    {badge.progress.target.toLocaleString()}
                  </span>
                </div>
                <div
                  className="h-2 w-full overflow-hidden rounded-full bg-white/10"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={badge.progress.target}
                  aria-valuenow={Math.min(badge.progress.current, badge.progress.target)}
                >
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "var(--gradient-primary)" }}
                    initial={{ width: 0 }}
                    animate={{
                      width: `${Math.min(100, Math.max(0, (badge.progress.current / badge.progress.target) * 100))}%`,
                    }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                  />
                </div>
              </div>
            )}

            {examples.length > 0 && (
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm">
                <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
                  How to earn it
                </div>
                <ul className="mt-1.5 space-y-1">
                  {examples.map((ex) => (
                    <li key={ex} className="flex items-start gap-2 text-sm text-white/85">
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                      <span>{ex}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <button
              onClick={onClose}
              className="mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white shadow-lg"
              style={{ background: badge.unlocked ? "var(--gradient-primary)" : "rgba(255,255,255,0.1)" }}
            >
              {badge.unlocked ? "Nice!" : "Keep exploring"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
