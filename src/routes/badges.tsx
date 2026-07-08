import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { getBadges, getPoints, getSeen, getStreak, type Badge } from "@/lib/store";

export const Route = createFileRoute("/badges")({
  head: () => ({
    meta: [
      { title: "Badges — Why?" },
      { name: "description", content: "Explorer badges you've earned on your curiosity journey." },
    ],
  }),
  component: BadgesPage,
});

function BadgesPage() {
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

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-28">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link
            to="/"
            className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-foreground/90 active:scale-95"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h1 className="font-display text-2xl font-black text-white">Your Badges</h1>
        </header>

        <div className="glass-strong mb-4 grid grid-cols-3 gap-3 rounded-3xl p-4 text-center">
          <Stat label="Points" value={points} />
          <Stat label="Streak" value={`${streak}🔥`} />
          <Stat label="Seen" value={seen} />
        </div>

        <p className="mb-3 text-sm text-white/60">
          Unlocked <span className="font-black text-white">{unlocked}</span> of {badges.length}
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {badges.map((b, i) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`glass flex flex-col items-center gap-2 rounded-3xl p-5 text-center ${
                b.unlocked ? "" : "opacity-40 grayscale"
              }`}
            >
              <div
                className="flex h-16 w-16 items-center justify-center rounded-2xl text-3xl shadow-lg"
                style={{
                  background: b.unlocked
                    ? "var(--gradient-primary)"
                    : "oklch(0.25 0.02 285)",
                }}
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
