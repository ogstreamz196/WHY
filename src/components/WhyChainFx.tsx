// Animated pieces for the "But… Why?" chain: depth meter, thinking bubble and
// the attention wiggle on the button. All loops stop under reduced motion.
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

export const MAX_CHAIN_DEPTH = 6;

const DEPTH_TITLES = [
  "Ready to dig?",
  "Curious",
  "Getting warmer",
  "Deep thinker",
  "Brain on fire",
  "Almost at the core",
  "Rabbit hole master",
];

/** Six dots that fill as the chain gets deeper, with a title for each level. */
export function DepthMeter({ depth }: { depth: number }) {
  const reduce = useReducedMotion();
  const clamped = Math.min(depth, MAX_CHAIN_DEPTH);
  return (
    <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
          Rabbit hole depth
        </p>
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={clamped}
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -6 }}
            transition={{ duration: 0.25 }}
            className="font-fun truncate text-sm font-bold text-white"
          >
            {DEPTH_TITLES[clamped]}
          </motion.p>
        </AnimatePresence>
      </div>
      <div
        className="flex shrink-0 items-center gap-1.5"
        aria-label={`Depth ${clamped} of ${MAX_CHAIN_DEPTH}`}
      >
        {Array.from({ length: MAX_CHAIN_DEPTH }, (_, i) => {
          const filled = i < clamped;
          return (
            <motion.span
              key={i}
              aria-hidden
              initial={false}
              animate={
                filled
                  ? { scale: reduce ? 1 : [1, 1.5, 1], opacity: 1 }
                  : { scale: 1, opacity: 0.35 }
              }
              transition={{ duration: 0.45, ease: "easeOut" }}
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background: filled
                  ? "linear-gradient(135deg, #f0abfc, #a855f7)"
                  : "rgba(255,255,255,0.25)",
                boxShadow: filled ? "0 0 10px rgba(217,70,239,0.7)" : "none",
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

const THINKING_LINES = [
  "Asking the universe…",
  "Consulting the wise owls…",
  "Following the rabbit…",
  "Peeking under the surface…",
  "Connecting the dots…",
];

/** Placeholder step shown while the next layer is being generated. */
export function ThinkingStep() {
  const reduce = useReducedMotion();
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setLine((l) => (l + 1) % THINKING_LINES.length), 1400);
    return () => window.clearInterval(t);
  }, []);
  return (
    <motion.li
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative"
      aria-live="polite"
    >
      <motion.span
        aria-hidden
        animate={reduce ? undefined : { rotate: [0, -12, 12, -6, 0] }}
        transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-9 top-1 flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-sm"
      >
        🤔
      </motion.span>
      <div className="flex items-center gap-3 rounded-2xl border border-dashed border-fuchsia-300/30 bg-fuchsia-500/[0.06] p-3">
        <span className="flex gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="h-2 w-2 rounded-full bg-fuchsia-300"
              animate={reduce ? undefined : { y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
            />
          ))}
        </span>
        <AnimatePresence mode="wait">
          <motion.p
            key={line}
            initial={{ opacity: 0, x: 6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.2 }}
            className="font-fun text-sm italic text-white/75"
          >
            {THINKING_LINES[line]}
          </motion.p>
        </AnimatePresence>
      </div>
    </motion.li>
  );
}

/** The 🤔 on the button, wiggling every few seconds to invite a tap. */
export function WigglingThinker() {
  const reduce = useReducedMotion();
  return (
    <motion.span
      aria-hidden
      className="inline-block"
      animate={reduce ? undefined : { rotate: [0, -18, 14, -8, 0], scale: [1, 1.2, 1.1, 1.05, 1] }}
      transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 2.6, ease: "easeInOut" }}
    >
      🤔
    </motion.span>
  );
}

/**
 * Floating "+N" bubbles that rise from a coin counter whenever `value` goes
 * up. Render inside a `relative` container.
 */
export function CoinGainFloaters({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const prev = useRef(value);
  // Balances sync from the server right after load; don't celebrate that jump.
  const mountedAt = useRef(Date.now());
  const [gains, setGains] = useState<{ id: number; delta: number }[]>([]);
  useEffect(() => {
    const delta = value - prev.current;
    prev.current = value;
    if (delta <= 0 || reduce || Date.now() - mountedAt.current < 2500) return;
    const id = Date.now() + Math.random();
    setGains((g) => [...g.slice(-3), { id, delta }]);
    const t = window.setTimeout(() => setGains((g) => g.filter((x) => x.id !== id)), 1200);
    return () => window.clearTimeout(t);
  }, [value, reduce]);
  return (
    <span
      aria-hidden
      className="pointer-events-none absolute inset-x-0 -bottom-1 flex justify-center"
    >
      <AnimatePresence>
        {gains.map((g) => (
          <motion.span
            key={g.id}
            initial={{ opacity: 0, y: 4, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: 30, scale: 1.1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.1, ease: "easeOut" }}
            className="absolute whitespace-nowrap rounded-full bg-amber-300 px-2 py-0.5 text-[11px] font-black text-amber-950 shadow-[0_0_14px_rgba(252,211,77,0.8)]"
          >
            +{g.delta} 🪙
          </motion.span>
        ))}
      </AnimatePresence>
    </span>
  );
}
