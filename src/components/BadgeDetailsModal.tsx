import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { X, Lock, Check, Sparkles, Calendar, Trophy } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";

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

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

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

  const panelRef = useRef<HTMLDivElement | null>(null);
  const initialFocusRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // ---- Focus management: save + restore, initial focus, Esc + Tab trap ----
  useEffect(() => {
    if (!badge) return;

    // Remember what had focus before the modal opened so we can return to it.
    previouslyFocusedRef.current =
      (document.activeElement as HTMLElement | null) ?? null;

    // Lock background scroll while the sheet is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Move initial focus into the dialog (primary action button).
    const focusTimer = window.setTimeout(() => {
      initialFocusRef.current?.focus();
    }, 30);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = panelRef.current;
      if (!panel) return;
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter(
        (el) =>
          !el.hasAttribute("disabled") &&
          el.getAttribute("aria-hidden") !== "true" &&
          el.offsetParent !== null,
      );
      if (nodes.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (e.shiftKey) {
        if (active === first || !panel.contains(active)) {
          e.preventDefault();
          last.focus();
        }
      } else if (active === last || !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKey, true);
    return () => {
      document.removeEventListener("keydown", handleKey, true);
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(focusTimer);
      // Restore focus to the element that triggered the modal, if it still exists.
      const prev = previouslyFocusedRef.current;
      if (prev && document.contains(prev)) {
        prev.focus();
      }
    };
  }, [badge, onClose]);

  // ---- Interactive tilt on the medallion (pointer parallax) ----
  const rx = useMotionValue(0);
  const ry = useMotionValue(0);
  const rotateX = useSpring(rx, { stiffness: 180, damping: 14 });
  const rotateY = useSpring(ry, { stiffness: 180, damping: 14 });
  const glareX = useTransform(ry, [-14, 14], ["25%", "75%"]);
  const glareY = useTransform(rx, [-14, 14], ["75%", "25%"]);

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      ry.set(px * 20);
      rx.set(-py * 20);
    },
    [rx, ry],
  );
  const resetTilt = useCallback(() => {
    rx.set(0);
    ry.set(0);
  }, [rx, ry]);

  return (
    <AnimatePresence>
      {badge && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="badge-details-title"
          aria-describedby="badge-details-requirement"
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 p-4 backdrop-blur-md sm:items-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            ref={panelRef}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            initial={{ y: 40, opacity: 0, scale: 0.94 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.94 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="glass-strong relative w-full max-w-sm overflow-hidden rounded-4xl border border-white/10 p-6 text-center text-white outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {/* Animated aurora backdrop */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute -inset-24 opacity-40"
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              style={{
                background:
                  "conic-gradient(from 0deg, transparent, rgba(168,85,247,0.35), transparent, rgba(236,72,153,0.35), transparent, rgba(56,189,248,0.35), transparent)",
                filter: "blur(40px)",
              }}
            />

            {/* Confetti burst on unlock */}
            {badge.unlocked && (
              <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
                {Array.from({ length: 14 }).map((_, i) => {
                  const angle = (i / 14) * Math.PI * 2;
                  const dist = 120 + (i % 3) * 30;
                  const hue = (i * 27) % 360;
                  return (
                    <motion.span
                      key={i}
                      className="absolute left-1/2 top-1/2 h-1.5 w-2.5 rounded-full"
                      style={{ background: `hsl(${hue} 90% 65%)` }}
                      initial={{ x: 0, y: 0, opacity: 0, scale: 0 }}
                      animate={{
                        x: Math.cos(angle) * dist,
                        y: Math.sin(angle) * dist,
                        opacity: [0, 1, 0],
                        scale: [0.4, 1, 0.6],
                        rotate: [0, 240],
                      }}
                      transition={{ duration: 1.4, delay: 0.15 + i * 0.02, ease: "easeOut" }}
                    />
                  );
                })}
              </div>
            )}

            <button
              ref={initialFocusRef}
              onClick={onClose}
              aria-label="Close badge details"
              className="absolute right-3 top-3 z-10 rounded-full bg-white/10 p-1.5 text-white/70 transition hover:scale-110 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Emoji medallion with pointer tilt */}
            <div
              className="relative mx-auto mb-3 flex h-28 w-28 items-center justify-center [perspective:600px]"
              onPointerMove={handlePointerMove}
              onPointerLeave={resetTilt}
            >
              {badge.unlocked && (
                <>
                  <motion.span
                    aria-hidden
                    className="absolute inset-0 rounded-full"
                    animate={{ scale: [1, 1.18, 1], opacity: [0.7, 0.15, 0.7] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    style={{ background: "var(--gradient-primary)", filter: "blur(20px)" }}
                  />
                  {Array.from({ length: 8 }).map((_, i) => (
                    <motion.span
                      key={i}
                      aria-hidden
                      className="absolute text-lg"
                      initial={{ opacity: 0 }}
                      animate={{
                        opacity: [0, 1, 0],
                        x: Math.cos((i / 8) * Math.PI * 2) * 62,
                        y: Math.sin((i / 8) * Math.PI * 2) * 62,
                        rotate: [0, 180],
                      }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.14, ease: "easeOut" }}
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
                    : { duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }
                }
                style={{
                  rotateX,
                  rotateY,
                  transformStyle: "preserve-3d",
                  background: badge.unlocked
                    ? "var(--gradient-primary)"
                    : "oklch(0.25 0.02 285)",
                }}
                className={`relative flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl text-5xl shadow-2xl ${
                  badge.unlocked ? "" : "grayscale"
                }`}
              >
                <span style={{ transform: "translateZ(24px)" }}>{badge.emoji}</span>
                {/* Glare highlight follows the tilt */}
                {badge.unlocked && (
                  <motion.span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 mix-blend-overlay"
                    style={{
                      background: useTransform(
                        [glareX, glareY],
                        ([x, y]) =>
                          `radial-gradient(circle at ${x} ${y}, rgba(255,255,255,0.55), transparent 55%)`,
                      ),
                    }}
                  />
                )}
                {!badge.unlocked && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-black/70 p-1.5">
                    <Lock className="h-3.5 w-3.5 text-white/80" />
                  </span>
                )}
              </motion.div>
            </div>

            <motion.p
              initial={{ y: 8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="relative text-[10px] font-black uppercase tracking-[0.3em] text-white/50"
            >
              {badge.unlocked ? (
                <span className="inline-flex items-center gap-1 text-amber-200">
                  <Trophy className="h-3 w-3" aria-hidden="true" /> Unlocked
                </span>
              ) : (
                "Locked"
              )}
            </motion.p>
            <motion.h3
              id="badge-details-title"
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.15 }}
              className="relative mt-1 font-display text-2xl font-black"
            >
              {badge.label}
            </motion.h3>

            {badge.unlocked && badge.unlockedAt && (
              <p className="relative mt-1 inline-flex items-center gap-1 text-xs text-white/60">
                <Calendar className="h-3 w-3" aria-hidden="true" />
                Unlocked {formatUnlockDate(badge.unlockedAt)}
              </p>
            )}

            <motion.div
              initial={{ y: 12, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.22 }}
              id="badge-details-requirement"
              className="relative mt-4 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm"
            >
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-widest text-white/50">
                <Sparkles className="h-3 w-3" /> Requirement
              </div>
              <p className="mt-1 text-sm text-white/90">{requirement}</p>
            </motion.div>

            {!badge.unlocked && badge.progress && badge.progress.target > 0 && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.28 }}
                className="relative mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left"
              >
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
                    transition={{ duration: 0.8, ease: "easeOut", delay: 0.35 }}
                  />
                </div>
              </motion.div>
            )}

            {examples.length > 0 && (
              <motion.div
                initial={{ y: 12, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.34 }}
                className="relative mt-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left text-sm"
              >
                <div className="text-[11px] font-black uppercase tracking-widest text-white/50">
                  How to earn it
                </div>
                <ul className="mt-1.5 space-y-1">
                  {examples.map((ex, i) => (
                    <motion.li
                      key={ex}
                      initial={{ x: -8, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.4 + i * 0.06 }}
                      className="flex items-start gap-2 text-sm text-white/85"
                    >
                      <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />
                      <span>{ex}</span>
                    </motion.li>
                  ))}
                </ul>
              </motion.div>
            )}

            <motion.button
              whileHover={{ scale: 1.02, y: -1 }}
              whileTap={{ scale: 0.97 }}
              onClick={onClose}
              className="relative mt-5 w-full rounded-2xl px-4 py-3 text-sm font-black text-white shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
              style={{ background: badge.unlocked ? "var(--gradient-primary)" : "rgba(255,255,255,0.1)" }}
            >
              {badge.unlocked ? "Nice!" : "Keep exploring"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
