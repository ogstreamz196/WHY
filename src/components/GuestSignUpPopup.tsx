import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  open: boolean;
  seconds: number;
  onClose: () => void;
};

/**
 * A friendly guest-only nudge that shows up every few facts.
 * The close button "runs away" from the cursor for `seconds` seconds while
 * a countdown ticks down. After the timer expires the popup can be closed.
 */
export function GuestSignUpPopup({ open, seconds, onClose }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [oops, setOops] = useState<{ id: number; x: number; y: number } | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const oopsId = useRef(0);

  useEffect(() => {
    if (!open) return;
    setRemaining(seconds);
    setOffset({ x: 0, y: 0 });
    const interval = window.setInterval(() => {
      setRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open, seconds]);

  const locked = remaining > 0;

  // Dodge on cursor approach while locked
  const dodge = (clientX: number, clientY: number) => {
    if (!locked) return;
    const el = boxRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    const dx = cx - clientX;
    const dy = cy - clientY;
    const dist = Math.max(1, Math.hypot(dx, dy));
    const push = 80;
    // Move away from the cursor with a bit of jitter
    const nx = (dx / dist) * push + (Math.random() * 30 - 15);
    const ny = (dy / dist) * push + (Math.random() * 30 - 15);
    // Clamp so it stays visible
    const maxX = Math.min(160, window.innerWidth / 2 - 80);
    const maxY = Math.min(160, window.innerHeight / 2 - 80);
    setOffset({
      x: Math.max(-maxX, Math.min(maxX, nx)),
      y: Math.max(-maxY, Math.min(maxY, ny)),
    });
    oopsId.current += 1;
    setOops({ id: oopsId.current, x: clientX, y: clientY });
    window.setTimeout(() => {
      setOops((o) => (o && o.id === oopsId.current ? null : o));
    }, 900);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          role="dialog"
          aria-modal="false"
          aria-label="Sign up nudge"
        >
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />

          <motion.div
            ref={boxRef}
            animate={{ x: offset.x, y: offset.y, rotate: locked ? [0, -1.5, 1.5, 0] : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 18, rotate: { duration: 0.4 } }}
            className="relative w-full max-w-sm rounded-3xl border-2 border-white/20 bg-gradient-to-br from-fuchsia-500/90 via-purple-600/90 to-indigo-600/90 p-5 text-white shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-fun text-lg font-black leading-tight">Loving the facts?</p>
                <p className="mt-1 text-sm text-white/85">
                  You're on a free trial — sign in to keep your streak, coins &amp; favourites forever.
                </p>
              </div>

              <button
                type="button"
                onMouseEnter={(e) => dodge(e.clientX, e.clientY)}
                onFocus={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  dodge(r.left, r.top);
                }}
                onClick={() => {
                  if (locked) return;
                  onClose();
                }}
                aria-label={locked ? `Wait ${remaining}s` : "Close"}
                className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
              >
                {locked ? (
                  <span className="text-sm font-black tabular-nums">{remaining}</span>
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-black text-purple-700 shadow hover:scale-[1.02] active:scale-95 transition"
              >
                <UserPlus className="h-4 w-4" /> Create free account
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="inline-flex items-center rounded-full border border-white/30 bg-white/10 px-4 py-2 text-sm font-black text-white hover:bg-white/20"
              >
                Sign in
              </Link>
            </div>

            {locked && (
              <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    key={remaining}
                    initial={{ width: `${((remaining) / seconds) * 100}%` }}
                    animate={{ width: `${((remaining - 1) / seconds) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                    className="h-full bg-white/80"
                  />
                </div>
                <span className="tabular-nums font-black">{remaining}s</span>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {oops && (
              <motion.div
                key={oops.id}
                initial={{ opacity: 0, scale: 0.6, y: 0 }}
                animate={{ opacity: 1, scale: 1, y: -30 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.8 }}
                style={{ left: oops.x, top: oops.y }}
                className="pointer-events-none fixed -translate-x-1/2 -translate-y-full select-none rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-purple-900 shadow-lg"
              >
                Oops, you missed! 🙈
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
