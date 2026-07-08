import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, History } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { BadgeDetailsModal } from "@/components/BadgeDetailsModal";
import { LevelProgressWidget } from "@/components/LevelProgressWidget";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { LevelUpCelebration } from "@/components/LevelUpCelebration";
import { useUnlockWatcher } from "@/lib/unlock-watch";
import { getBadges, getPoints, getSeen, getStreak, type Badge } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth";

export const Route = createFileRoute("/badges")({
  head: () => ({
    meta: [
      { title: "Badges — Why?" },
      { name: "description", content: "Explorer badges, XP levels and milestones on your curiosity journey." },
    ],
  }),
  component: BadgesPage,
});

const MILESTONES = [
  { key: "seen",   label: "Facts discovered", steps: [10, 50, 100, 250, 500, 1000] },
  { key: "streak", label: "Day streak",       steps: [3, 7, 14, 30, 60, 100] },
  { key: "points", label: "Curiosity points", steps: [100, 500, 1000, 5000, 10000, 25000] },
] as const;

function BadgesPage() {
  const { user } = useCurrentUser();
  const [badges, setBadges] = useState<Badge[]>([]);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);
  const [seen, setSeen] = useState(0);

  useEffect(() => {
    setBadges(getBadges());
    setPoints(getPoints());
    setStreak(getStreak());
    setSeen(getSeen());
  }, []);

  const unlocked = badges.filter((b) => b.unlocked).length;
  const stats: Record<string, number> = { seen, streak, points };
  const [selected, setSelected] = useState<Badge | null>(null);
  const { confettiTrigger, levelUp, dismissLevelUp } = useUnlockWatcher(badges);

  const widgetMilestones = useMemo(() => {
    return MILESTONES.map((m) => {
      const current = stats[m.key] ?? 0;
      const nextIdx = m.steps.findIndex((s) => current < s);
      const next = nextIdx === -1 ? m.steps[m.steps.length - 1] : m.steps[nextIdx];
      return { label: m.label, value: current, next };
    });
  }, [stats]);

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />
      <ConfettiBurst trigger={confettiTrigger} />
      <LevelUpCelebration
        open={!!levelUp}
        level={levelUp?.level ?? 0}
        title={levelUp?.title ?? ""}
        onClose={dismissLevelUp}
      />
      <BadgeDetailsModal badge={selected} onClose={() => setSelected(null)} />
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link to="/" className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-foreground/90 active:scale-95">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-black text-white">Your Badges</h1>
          {user && (
            <Link
              to="/history"
              className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-black text-white/80 hover:text-white"
            >
              <History className="h-3.5 w-3.5" /> History
            </Link>
          )}
        </header>

        <LevelProgressWidget xp={points} milestones={widgetMilestones} />

        <div className="glass-strong mb-4 grid grid-cols-3 gap-3 rounded-3xl p-4 text-center">
          <Stat label="Points" value={points} />
          <Stat label="Streak" value={`${streak}🔥`} />
          <Stat label="Seen" value={seen} />
        </div>


        {/* Milestones */}
        <section className="mb-4">
          <h2 className="mb-2 font-display text-lg font-black text-white">Milestones</h2>
          <div className="space-y-2">
            {MILESTONES.map((m) => {
              const current = stats[m.key] ?? 0;
              const nextIdx = m.steps.findIndex((s) => current < s);
              const next = nextIdx === -1 ? m.steps[m.steps.length - 1] : m.steps[nextIdx];
              const prev = nextIdx <= 0 ? 0 : m.steps[nextIdx - 1];
              const pct = nextIdx === -1 ? 100 : Math.min(100, Math.round(((current - prev) / (next - prev)) * 100));
              return (
                <div key={m.key} className="glass rounded-2xl p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-white">{m.label}</span>
                    <span className="font-bold text-white/60">
                      {current.toLocaleString()} / {next.toLocaleString()}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: "var(--gradient-primary)" }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <p className="mb-3 text-sm text-white/60">
          Unlocked <span className="font-black text-white">{unlocked}</span> of {badges.length}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badges.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              whileHover={{ scale: b.unlocked ? 1.05 : 1, rotate: b.unlocked ? [0, -2, 2, 0] : 0 }}
              transition={{ delay: i * 0.04 }}
              className={`glass relative flex flex-col items-center gap-2 rounded-3xl p-5 text-center ${
                b.unlocked ? "" : "opacity-40 grayscale"
              }`}
            >
              {b.unlocked && (
                <motion.span
                  aria-hidden
                  className="absolute inset-0 rounded-3xl"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: [0, 0.4, 0] }}
                  transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.15 }}
                  style={{ boxShadow: "0 0 30px 4px rgba(168,85,247,0.35) inset" }}
                />
              )}
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
                style={{ background: b.unlocked ? "var(--gradient-primary)" : "oklch(0.25 0.02 285)" }}
              >
                {b.emoji}
              </div>
              <p className="text-sm font-black text-white">{b.label}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-white/50">
                {b.unlocked ? "Unlocked" : "Locked"}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div>
      <p className="font-display text-2xl font-black text-white">{value}</p>
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/60">{label}</p>
    </div>
  );
}
