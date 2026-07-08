import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, useCallback } from "react";
import { getRandomFact, generateAndStoreFact, type Fact } from "@/lib/facts.functions";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Why? — Fun facts for curious minds" },
      {
        name: "description",
        content:
          "Do you know why…? A never-ending stream of child-friendly, fun and educational facts for families, kids and adults.",
      },
      { property: "og:title", content: "Why? — Fun facts for curious minds" },
      {
        property: "og:description",
        content: "Tap Next for a new 'Do you know why…' fact. Fun, safe, educational.",
      },
      { property: "og:type", content: "website" },
      { name: "theme-color", content: "#7c3aed" },
    ],
  }),
  component: WhyApp,
});

function WhyApp() {
  const getRandom = useServerFn(getRandomFact);
  const generateNew = useServerFn(generateAndStoreFact);

  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);

  const loadNext = useCallback(
    async (currentId?: string) => {
      setLoading(true);
      setError(null);
      setRevealed(false);
      try {
        // Every ~4th tap, ask the AI to invent + store a brand new fact so the
        // DB keeps growing organically as people play.
        const wantNew = Math.random() < 0.25;
        let next: Fact | null = null;
        if (wantNew) {
          try {
            next = await generateNew();
          } catch (err) {
            console.warn("AI generation failed, falling back to random", err);
          }
        }
        if (!next) {
          next = await getRandom({ data: { excludeId: currentId } });
        }
        setFact(next);
      } catch (err) {
        console.error(err);
        setError("Hmm, couldn't load a fact. Tap Next to try again.");
      } finally {
        setLoading(false);
      }
    },
    [getRandom, generateNew],
  );

  useEffect(() => {
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="relative min-h-screen w-full overflow-hidden">
      {/* Playful gradient background */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 10%, #fde68a 0%, transparent 55%), radial-gradient(1000px 700px at 90% 20%, #a5f3fc 0%, transparent 60%), radial-gradient(900px 700px at 50% 100%, #ddd6fe 0%, transparent 60%), linear-gradient(180deg, #fef3c7 0%, #ede9fe 100%)",
        }}
      />

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col px-5 pb-8 pt-8 sm:pt-12">
        {/* Header */}
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
            <span className="text-violet-700">Why</span>
            <span className="text-amber-500">?</span>
          </h1>
          <span className="rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-violet-700 shadow-sm backdrop-blur">
            Fun facts, every tap
          </span>
        </header>

        {/* Fact card */}
        <section className="flex flex-1 items-center">
          <div className="w-full rounded-3xl bg-white/85 p-6 shadow-xl ring-1 ring-black/5 backdrop-blur sm:p-8">
            {loading ? (
              <FactSkeleton />
            ) : error ? (
              <p className="text-center text-lg text-rose-600">{error}</p>
            ) : fact ? (
              <article>
                <p className="text-sm font-bold uppercase tracking-widest text-amber-600">
                  Do you know why…
                </p>
                <h2 className="mt-3 text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
                  {capitalize(fact.question)}
                </h2>

                <div
                  className={`mt-6 overflow-hidden transition-all duration-500 ease-out ${
                    revealed ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
                  }`}
                >
                  <div className="rounded-2xl bg-violet-50 p-4 sm:p-5">
                    <p className="text-base leading-relaxed text-slate-800 sm:text-lg">
                      {fact.answer}
                    </p>
                    {fact.category && (
                      <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-violet-500">
                        #{fact.category}
                      </p>
                    )}
                  </div>
                </div>

                {!revealed && (
                  <button
                    type="button"
                    onClick={() => setRevealed(true)}
                    className="mt-6 w-full rounded-2xl border-2 border-dashed border-violet-300 bg-white/70 px-4 py-4 text-base font-bold text-violet-700 transition hover:bg-white active:scale-[0.99]"
                  >
                    Tap to reveal the answer 👀
                  </button>
                )}
              </article>
            ) : (
              <p className="text-center text-slate-600">No facts yet. Tap Next!</p>
            )}
          </div>
        </section>

        {/* Giant Next button */}
        <div className="mt-8 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            disabled={loading}
            onClick={() => loadNext(fact?.id)}
            className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-500 px-6 py-6 text-2xl font-black uppercase tracking-wide text-white shadow-2xl shadow-violet-500/40 transition active:scale-[0.98] disabled:opacity-70 sm:py-8 sm:text-3xl"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              {loading ? "Thinking…" : "Next fact"}
              <span className="text-3xl transition group-hover:translate-x-1 sm:text-4xl">➜</span>
            </span>
          </button>
          <p className="mt-3 text-center text-xs text-slate-600">
            New facts are added automatically by AI ✨
          </p>
        </div>
      </div>
    </main>
  );
}

function FactSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="h-3 w-40 rounded bg-amber-200" />
      <div className="mt-4 h-6 w-11/12 rounded bg-slate-200" />
      <div className="mt-2 h-6 w-8/12 rounded bg-slate-200" />
      <div className="mt-6 h-24 w-full rounded-2xl bg-violet-100" />
    </div>
  );
}

function capitalize(s: string) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
