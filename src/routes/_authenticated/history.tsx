import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Sparkles } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { LevelUpCelebration } from "@/components/LevelUpCelebration";
import { useUnlockWatcher } from "@/lib/unlock-watch";
import { listMyDiscoveries } from "@/lib/account.functions";
import { emojiFor, gradientFor } from "@/lib/categories";
import { SkeletonBlock, EmptyState } from "@/components/FunStates";

export const Route = createFileRoute("/_authenticated/history")({
  head: () => ({
    meta: [
      { title: "Discovery History — Why?" },
      { name: "description", content: "Every fact you've discovered on your curiosity journey." },
    ],
  }),
  component: HistoryPage,
});

function timeAgo(iso: string): string {
  const s = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function HistoryPage() {
  const fetchHistory = useServerFn(listMyDiscoveries);
  const q = useQuery({
    queryKey: ["my-discoveries"],
    queryFn: () => fetchHistory({ data: { limit: 100 } }),
  });

  const items = q.data ?? [];
  const { confettiTrigger, levelUp, dismissLevelUp } = useUnlockWatcher(items.length);

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
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-4 flex items-center gap-2">
          <Link to="/badges" className="glass flex h-11 w-11 items-center justify-center rounded-2xl text-white/90">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex-1">
            <h1 className="font-display text-2xl font-black text-white">Discovery History</h1>
            <p className="text-xs text-white/60">Every "why" you've explored, in order.</p>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-black text-white">
            {items.length}
          </span>
        </header>

        {q.isLoading ? (
          <div className="space-y-2" role="status" aria-live="polite" aria-label="Loading your discoveries">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonBlock key={i} height="5rem" className="rounded-2xl" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            emoji="✨"
            title="No discoveries yet"
            hint="Tap Next on a fact to start your curiosity trail."
            action={
              <Link
                to="/"
                className="inline-block rounded-full px-4 py-2 text-xs font-black text-white"
                style={{ background: "var(--gradient-primary)" }}
              >
                Discover a fact
              </Link>
            }
          />
        ) : (
          <ol className="space-y-2">
            {items.map((entry, i) => {
              const f = entry.fact;
              const gradient = gradientFor(f?.category ?? null);
              return (
                <motion.li
                  key={entry.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="glass overflow-hidden rounded-2xl border border-white/10 p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-lg shadow"
                      style={{ background: gradient }}
                    >
                      {emojiFor(f?.category ?? null)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-black text-white">
                        {f?.question ?? "(fact removed)"}
                      </p>
                      {f?.answer && (
                        <p className="mt-0.5 line-clamp-2 text-xs text-white/60">{f.answer}</p>
                      )}
                      <div className="mt-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-white/50">
                        {f?.category && <span>{f.category}</span>}
                        <span>·</span>
                        <span>{timeAgo(entry.seen_at)}</span>
                      </div>
                    </div>
                  </div>
                </motion.li>
              );
            })}
          </ol>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
