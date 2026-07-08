import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const COLORS = ["#a855f7", "#22d3ee", "#f59e0b", "#ec4899", "#34d399", "#facc15"];

/**
 * Fires a confetti burst whenever `trigger` changes to a new truthy value.
 * Renders as a fixed, non-interactive overlay.
 */
export function ConfettiBurst({ trigger, duration = 1800 }: { trigger: number; duration?: number }) {
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (!trigger) return;
    setKey((k) => k + 1);
    const t = setTimeout(() => setKey(0), duration + 200);
    return () => clearTimeout(t);
  }, [trigger, duration]);

  const pieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * window.innerWidth * 0.9,
        y: -window.innerHeight * 0.55 + Math.random() * 80,
        rot: Math.random() * 720,
        color: COLORS[i % COLORS.length],
        delay: Math.random() * 0.15,
        size: 6 + Math.random() * 6,
      })),
    [key],
  );

  return (
    <AnimatePresence>
      {key > 0 && (
        <div className="pointer-events-none fixed inset-0 z-[90] overflow-hidden">
          {pieces.map((p) => (
            <motion.span
              key={p.id}
              className="absolute left-1/2 top-1/2 rounded-sm"
              style={{ backgroundColor: p.color, width: p.size, height: p.size }}
              initial={{ x: 0, y: 0, opacity: 0, rotate: 0 }}
              animate={{ x: p.x, y: p.y, opacity: [0, 1, 1, 0], rotate: p.rot }}
              exit={{ opacity: 0 }}
              transition={{ duration: duration / 1000, delay: p.delay, ease: "easeOut" }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
