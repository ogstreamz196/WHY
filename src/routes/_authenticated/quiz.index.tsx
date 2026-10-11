import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Brain, Loader2, Trophy, Zap } from "lucide-react";
import { toast } from "sonner";
import { CosmicBackground } from "@/components/CosmicBackground";
import { BottomNav } from "@/components/BottomNav";
import { CATEGORIES, gradientFor } from "@/lib/categories";
import { startQuiz, type Difficulty } from "@/lib/quiz.functions";

export const Route = createFileRoute("/_authenticated/quiz/")({
  head: () => ({
    meta: [
      { title: "Curiosity Challenge — Why?" },
      { name: "description", content: "Test what you know and climb the leaderboards." },
    ],
  }),
  component: QuizStartPage,
});

const DIFFICULTIES: { key: Difficulty; label: string; hint: string; mult: string }[] = [
  { key: "easy", label: "Easy", hint: "15s per question", mult: "×1" },
  { key: "medium", label: "Medium", hint: "12s per question", mult: "×1.25" },
  { key: "hard", label: "Hard", hint: "10s per question", mult: "×1.5" },
  { key: "expert", label: "Expert", hint: "8s per question", mult: "×2" },
];

function QuizStartPage() {
  const navigate = useNavigate();
  const start = useServerFn(startQuiz);
  const [category, setCategory] = useState<string>("all");
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [length, setLength] = useState<number>(5);
  const [loading, setLoading] = useState(false);

  async function begin() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await start({ data: { category, difficulty, length } });
      // Stash questions in sessionStorage so the play screen doesn't refetch
      sessionStorage.setItem(`quiz:${res.session_id}`, JSON.stringify(res));
      navigate({ to: "/quiz/$sessionId", params: { sessionId: res.session_id } });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Could not start quiz";
      toast.error(msg);
      setLoading(false);
    }
  }

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
          <div className="flex-1">
            <h1 className="font-display text-2xl font-black text-white">Curiosity Challenge</h1>
            <p className="text-xs text-white/60">
              Answer fast, build streaks, top the leaderboard.
            </p>
          </div>
          <Link
            to="/leaderboard"
            className="glass flex h-11 items-center gap-1 rounded-2xl px-3 text-sm font-bold text-white/90 active:scale-95"
          >
            <Trophy className="h-4 w-4 text-amber-300" /> Ranks
          </Link>
        </header>

        <section className="glass-strong mb-4 rounded-3xl p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/50">
            Category
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setCategory(c.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
                    active
                      ? "border-transparent text-white shadow-[var(--shadow-glow)]"
                      : "border-white/10 bg-white/5 text-white/70"
                  }`}
                  style={active ? { background: c.gradient } : undefined}
                >
                  <span>{c.emoji}</span> {c.label}
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-strong mb-4 rounded-3xl p-4">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-white/50">
            Difficulty
          </p>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTIES.map((d) => {
              const active = difficulty === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => setDifficulty(d.key)}
                  className={`rounded-2xl border p-3 text-left transition ${
                    active ? "border-white/30 bg-white/10" : "border-white/10 bg-white/[0.03]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-black text-white">{d.label}</span>
                    <span className="text-[10px] font-black text-amber-300">{d.mult}</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-white/50">{d.hint}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="glass-strong mb-4 rounded-3xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
              Questions
            </p>
            <span className="text-sm font-black text-white">{length}</span>
          </div>
          <input
            type="range"
            min={3}
            max={10}
            step={1}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="mt-2 w-full accent-fuchsia-400"
          />
        </section>

        <motion.button
          type="button"
          onClick={begin}
          disabled={loading}
          whileTap={{ scale: 0.97 }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 text-base font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
          style={{ background: gradientFor(category === "all" ? undefined : category) }}
        >
          {loading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <>
              <Zap className="h-5 w-5" /> Start challenge
            </>
          )}
        </motion.button>

        <p className="mt-3 flex items-center justify-center gap-1 text-[11px] text-white/40">
          <Brain className="h-3 w-3" /> Correct +10 · Fast +5 · Perfect quiz gets a 1.5× bonus
        </p>
      </div>
      <BottomNav />
    </main>
  );
}
