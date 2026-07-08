import { motion } from "framer-motion";
import { Flame, Lock } from "lucide-react";

export const STREAK_MILESTONES = [
  { days: 3, label: "Spark", emoji: "✨" },
  { days: 7, label: "Weekly Wonder", emoji: "🔥" },
  { days: 14, label: "Fortnight Flame", emoji: "🌟" },
  { days: 30, label: "Monthly Master", emoji: "🏆" },
  { days: 60, label: "Curiosity Comet", emoji: "☄️" },
  { days: 100, label: "Century Champion", emoji: "👑" },
] as const;

export type StreakMilestone = (typeof STREAK_MILESTONES)[number];

export function milestoneFor(days: number): StreakMilestone | null {
  let hit: StreakMilestone | null = null;
  for (const m of STREAK_MILESTONES) if (days >= m.days) hit = m;
  return hit;
}

/** Returns the milestone the user just crossed, if `days` equals one exactly. */
export function newlyReachedMilestone(days: number): StreakMilestone | null {
  return STREAK_MILESTONES.find((m) => m.days === days) ?? null;
}

type Props = {
  currentStreak: number;
  longestStreak?: number;
};

export function StreakBadges({ currentStreak, longestStreak = 0 }: Props) {
  const reference = Math.max(currentStreak, longestStreak);
  return (
    <section className="mt-6">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="inline-flex items-center gap-2 font-display text-xl font-black text-white">
          <Flame className="h-5 w-5 text-orange-400" /> Streak badges
        </h2>
        <span className="text-xs font-bold text-white/60">
          {currentStreak}🔥 current
        </span>
      </header>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
        {STREAK_MILESTONES.map((m) => {
          const unlocked = reference >= m.days;
          const active = currentStreak >= m.days;
          return (
            <motion.div
              key={m.days}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ scale: unlocked ? 1.05 : 1 }}
              className={[
                "relative flex flex-col items-center rounded-2xl border p-2.5 text-center",
                unlocked
                  ? "border-orange-300/40 bg-gradient-to-b from-orange-500/25 to-fuchsia-500/15 shadow-[0_6px_24px_-8px_rgba(251,146,60,0.6)]"
                  : "border-white/10 bg-white/5 opacity-70",
              ].join(" ")}
            >
              <div className="text-2xl leading-none">
                {unlocked ? m.emoji : <Lock className="mx-auto h-5 w-5 text-white/40" />}
              </div>
              <div className="mt-1 text-[10px] font-black uppercase tracking-wider text-white/80">
                {m.label}
              </div>
              <div className="text-[10px] font-bold text-white/60">{m.days} days</div>
              {active && (
                <span className="absolute -right-1 -top-1 rounded-full bg-orange-500 px-1.5 py-0.5 text-[9px] font-black text-white shadow">
                  ON
                </span>
              )}
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
