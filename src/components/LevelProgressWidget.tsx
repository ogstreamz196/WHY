import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect } from "react";
import { Sparkles, Trophy } from "lucide-react";
import { levelFor } from "@/lib/levels";

type Props = {
  xp: number;
  /** Optional milestone counters to show under the bar. */
  milestones?: Array<{ label: string; value: number; next: number }>;
};

/** Animated XP level + milestone widget. Numbers count up smoothly on change. */
export function LevelProgressWidget({ xp, milestones = [] }: Props) {
  const info = levelFor(xp);

  // Animated numeric counters.
  const xpMv = useMotionValue(0);
  const xpSpring = useSpring(xpMv, { stiffness: 90, damping: 22 });
  const xpDisplay = useTransform(xpSpring, (v) => Math.round(v).toLocaleString());

  const pctMv = useMotionValue(0);
  const pctSpring = useSpring(pctMv, { stiffness: 90, damping: 22 });
  const barWidth = useTransform(pctSpring, (v) => `${Math.max(0, Math.min(100, v))}%`);

  useEffect(() => {
    xpMv.set(xp);
    pctMv.set(info.progressPct);
  }, [xp, info.progressPct, xpMv, pctMv]);

  return (
    <motion.section
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong relative mb-4 overflow-hidden rounded-3xl p-5 text-white shadow-[var(--shadow-card)]"
      style={{ background: "var(--gradient-primary)" }}
    >
      {/* animated shimmer */}
      <motion.span
        aria-hidden
        className="pointer-events-none absolute -inset-y-2 -left-1/3 w-1/3 rotate-12"
        style={{
          background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent)",
        }}
        animate={{ x: ["0%", "400%"] }}
        transition={{ duration: 4.5, repeat: Infinity, ease: "linear" }}
      />

      <div className="relative flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white/80">
            Level {info.level}
          </p>
          <p className="font-display text-2xl font-black leading-tight">{info.title}</p>
          <p className="mt-0.5 flex items-baseline gap-1 text-xs text-white/85">
            <motion.span className="font-black text-white">{xpDisplay}</motion.span>
            <span>XP</span>
          </p>
        </div>
        <motion.div
          initial={{ rotate: -12, scale: 0.8 }}
          animate={{ rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 15 }}
          className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 shadow-inner backdrop-blur"
        >
          <Sparkles className="h-7 w-7 text-white drop-shadow" />
        </motion.div>
      </div>

      <div className="relative mt-4 h-2.5 overflow-hidden rounded-full bg-black/25">
        <motion.div
          className="h-full rounded-full bg-white/95 shadow-[0_0_18px_rgba(255,255,255,0.7)]"
          style={{ width: barWidth }}
        />
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-white/90">
        <Trophy className="h-3.5 w-3.5" />
        {info.next
          ? `${info.xpToNext?.toLocaleString()} XP to ${info.next.title}`
          : "Max tier reached — legendary!"}
      </p>

      {milestones.length > 0 && (
        <div className="relative mt-4 grid grid-cols-3 gap-2">
          {milestones.map((m) => {
            const pct = Math.min(100, Math.round((m.value / Math.max(1, m.next)) * 100));
            return (
              <div key={m.label} className="rounded-2xl bg-black/25 p-2.5 backdrop-blur-sm">
                <p className="text-[9px] font-black uppercase tracking-widest text-white/70">
                  {m.label}
                </p>
                <p className="mt-0.5 font-display text-sm font-black">
                  {m.value.toLocaleString()}
                  <span className="text-white/60"> / {m.next.toLocaleString()}</span>
                </p>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    className="h-full rounded-full bg-white"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
