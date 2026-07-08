import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  generateAndStoreFact,
  generateWhyLayer,
  getRandomFact,
  searchOrGenerateFact,
  type Fact,
} from "@/lib/facts.functions";
import {
  addPoints,
  bumpSeen,
  cacheFact,
  getCachedRandomFact,
  getPoints,
  getStreak,
  isFavorite,
  toggleFavorite,
  touchStreak,
} from "@/lib/store";
import { CATEGORIES, emojiFor, type CategoryKey } from "@/lib/categories";

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

type Reaction = "like" | "love" | null;

function WhyApp() {
  const getRandom = useServerFn(getRandomFact);
  const generateNew = useServerFn(generateAndStoreFact);
  const generateLayer = useServerFn(generateWhyLayer);
  const searchOrGen = useServerFn(searchOrGenerateFact);

  const [fact, setFact] = useState<Fact | null>(null);
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<CategoryKey>("all");
  const [fav, setFav] = useState(false);
  const [reaction, setReaction] = useState<Reaction>(null);
  const [points, setPoints] = useState(0);
  const [streak, setStreak] = useState(0);

  // Randomize next AI-generation cadence between 4 and 10 taps.
  const nextGenAt = useRef<number>(4 + Math.floor(Math.random() * 7));
  const tapCount = useRef<number>(0);

  const [chain, setChain] = useState<{ question: string; answer: string }[]>([]);
  const [chainLoading, setChainLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [searching, setSearching] = useState(false);

  // hydrate points/streak on mount
  useEffect(() => {
    setPoints(getPoints());
    const s = touchStreak();
    setStreak(s.streak);
  }, []);

  const showFact = useCallback((f: Fact | null) => {
    setFact(f);
    setRevealed(false);
    setChain([]);
    setReaction(null);
    setFav(f ? isFavorite(f.id) : false);
    if (f) cacheFact(f);
  }, []);

  const loadNext = useCallback(
    async (currentId?: string, opts?: { forceGenerate?: boolean }) => {
      setLoading(true);
      setError(null);
      try {
        tapCount.current += 1;
        const cat = category === "all" ? undefined : category;

        const shouldGenerate =
          opts?.forceGenerate ||
          tapCount.current >= nextGenAt.current ||
          Math.random() < 0.05; // small chance of surprise generation

        let next: Fact | null = null;
        if (shouldGenerate) {
          try {
            next = await generateNew({ data: { category: cat } });
          } catch (e) {
            console.warn("[why?] generate failed", e);
          }
          if (next) {
            tapCount.current = 0;
            nextGenAt.current = 4 + Math.floor(Math.random() * 7);
          }
        }
        if (!next) {
          next = await getRandom({ data: { excludeId: currentId, category: cat } });
        }

        if (!next) {
          // Offline / no network → cache
          const cached = getCachedRandomFact(currentId);
          if (cached) next = cached;
        }
        showFact(next);
        bumpSeen();
        setPoints(addPoints(1));
      } catch (err) {
        console.error(err);
        const cached = getCachedRandomFact(currentId);
        if (cached) {
          showFact(cached);
          setError("You're offline — showing a cached fact.");
        } else {
          setError("Couldn't load a fact. Try again.");
        }
      } finally {
        setLoading(false);
      }
    },
    [category, generateNew, getRandom, showFact],
  );

  // initial load
  useEffect(() => {
    void loadNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // reload when category changes
  useEffect(() => {
    void loadNext(fact?.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const reveal = () => {
    if (revealed) return;
    setRevealed(true);
    setPoints(addPoints(2));
  };

  const askWhy = async () => {
    if (!fact) return;
    setChainLoading(true);
    try {
      const prev = chain.flatMap((c) => [c.question, c.answer]);
      const layer = await generateLayer({
        data: { rootQuestion: fact.question, previousChain: prev },
      });
      if (layer) {
        setChain((c) => [...c, layer]);
        setPoints(addPoints(3));
      }
    } catch (e) {
      console.warn(e);
    } finally {
      setChainLoading(false);
    }
  };

  const handleShare = async () => {
    if (!fact) return;
    const url = typeof window !== "undefined" ? window.location.origin : "https://why.app";
    const text = `🤔 WHY?\n\nDo you know why ${fact.question}\n\nTap to discover the answer.\n${url}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "Why?", text, url });
      } else {
        await navigator.clipboard.writeText(text);
        alert("Copied to clipboard!");
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleFav = () => {
    if (!fact) return;
    const now = toggleFavorite(fact);
    setFav(now);
    if (now) setPoints(addPoints(1));
  };

  const doSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = search.trim();
    if (q.length < 2) return;
    setSearching(true);
    setError(null);
    try {
      const f = await searchOrGen({ data: { query: q } });
      if (f) {
        showFact(f);
        setSearch("");
      } else {
        setError("Couldn't find or make a fact for that. Try another question!");
      }
    } catch (err) {
      console.error(err);
      setError("Search failed. Try again in a moment.");
    } finally {
      setSearching(false);
    }
  };

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(1200px 600px at 15% 10%, #fde68a 0%, transparent 55%), radial-gradient(1000px 700px at 90% 20%, #a5f3fc 0%, transparent 60%), radial-gradient(900px 700px at 50% 100%, #ddd6fe 0%, transparent 60%), linear-gradient(180deg, #fef3c7 0%, #ede9fe 100%)",
        }}
      />

      <div className="mx-auto flex min-h-[100dvh] max-w-2xl flex-col px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        {/* Header */}
        <header className="mb-4 flex items-center justify-between gap-3">
          <Link to="/" className="text-3xl font-black tracking-tight sm:text-4xl">
            <span className="text-violet-700">Why</span>
            <span className="text-amber-500">?</span>
          </Link>
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm backdrop-blur">
              🔥 {streak}
            </span>
            <span className="rounded-full bg-white/80 px-3 py-1 shadow-sm backdrop-blur">
              ⭐ {points}
            </span>
            <Link
              to="/favorites"
              className="rounded-full bg-white/80 px-3 py-1 shadow-sm backdrop-blur hover:bg-white"
              aria-label="Favorites"
            >
              ❤️
            </Link>
            <Link
              to="/settings"
              className="rounded-full bg-white/80 px-3 py-1 shadow-sm backdrop-blur hover:bg-white"
              aria-label="Settings"
            >
              ⚙️
            </Link>
          </div>
        </header>

        {/* Search */}
        <form onSubmit={doSearch} className="mb-3">
          <div className="flex items-center gap-2 rounded-2xl bg-white/85 p-1.5 shadow-sm ring-1 ring-black/5 backdrop-blur">
            <span className="pl-2 text-lg">🔍</span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ask a why question…"
              maxLength={200}
              className="flex-1 bg-transparent px-1 py-2 text-base text-slate-800 placeholder-slate-400 outline-none"
            />
            <button
              type="submit"
              disabled={searching || search.trim().length < 2}
              className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-bold text-white shadow disabled:opacity-50"
            >
              {searching ? "…" : "Ask"}
            </button>
          </div>
        </form>

        {/* Category chips */}
        <div className="-mx-4 mb-4 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex gap-2">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => setCategory(c.key)}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold shadow-sm transition ${
                  category === c.key
                    ? "bg-violet-600 text-white"
                    : "bg-white/80 text-slate-700 hover:bg-white"
                }`}
              >
                <span className="mr-1">{c.emoji}</span>
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Fact card */}
        <section className="flex flex-1 items-start">
          <div
            key={fact?.id ?? "loading"}
            className="w-full animate-in fade-in slide-in-from-bottom-2 duration-500"
          >
            <div className="rounded-3xl bg-white/90 p-5 shadow-xl ring-1 ring-black/5 backdrop-blur sm:p-7">
              {loading ? (
                <FactSkeleton />
              ) : error && !fact ? (
                <p className="text-center text-lg text-rose-600">{error}</p>
              ) : fact ? (
                <article>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                      🤔 Do you know why…
                    </p>
                    <span className="text-2xl" aria-hidden>
                      {emojiFor(fact.category)}
                    </span>
                  </div>
                  <h1 className="mt-3 text-2xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
                    {capitalize(fact.question)}
                  </h1>

                  {!revealed ? (
                    <button
                      type="button"
                      onClick={reveal}
                      className="mt-6 w-full rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 px-4 py-4 text-base font-bold text-white shadow-lg shadow-violet-500/30 transition active:scale-[0.99]"
                    >
                      Reveal Answer ✨
                    </button>
                  ) : (
                    <div className="mt-5 space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                      <div className="rounded-2xl bg-violet-50 p-4 sm:p-5">
                        <p className="text-base leading-relaxed text-slate-800 sm:text-lg">
                          {fact.answer}
                        </p>
                      </div>

                      {fact.fun_fact && (
                        <div className="rounded-2xl bg-amber-50 p-4 ring-1 ring-amber-200">
                          <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                            ⭐ Fun Fact
                          </p>
                          <p className="mt-1 text-sm leading-relaxed text-slate-800 sm:text-base">
                            {fact.fun_fact}
                          </p>
                        </div>
                      )}

                      {/* But… why? chain */}
                      {chain.map((layer, i) => (
                        <div
                          key={i}
                          className="rounded-2xl bg-cyan-50 p-4 ring-1 ring-cyan-200 animate-in fade-in slide-in-from-top-1 duration-300"
                        >
                          <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">
                            🤔 But… why?
                          </p>
                          <p className="mt-1 text-sm font-semibold text-slate-900">
                            {layer.question}
                          </p>
                          <p className="mt-2 text-sm leading-relaxed text-slate-800">
                            {layer.answer}
                          </p>
                        </div>
                      ))}

                      <button
                        type="button"
                        onClick={askWhy}
                        disabled={chainLoading || chain.length >= 6}
                        className="w-full rounded-2xl border-2 border-dashed border-cyan-400 bg-white/70 px-4 py-3 text-sm font-bold text-cyan-700 transition hover:bg-white disabled:opacity-50"
                      >
                        {chainLoading
                          ? "Digging deeper…"
                          : chain.length >= 6
                            ? "That's deep enough! 🌌"
                            : "🤔 But… Why?"}
                      </button>

                      {/* Reactions */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          type="button"
                          onClick={() => {
                            setReaction("like");
                            if (reaction !== "like") setPoints(addPoints(1));
                          }}
                          className={`flex-1 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                            reaction === "like"
                              ? "bg-emerald-500 text-white"
                              : "bg-white text-slate-700 ring-1 ring-slate-200"
                          }`}
                        >
                          👍 Interesting
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReaction("love");
                            if (reaction !== "love") setPoints(addPoints(2));
                          }}
                          className={`flex-1 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                            reaction === "love"
                              ? "bg-rose-500 text-white"
                              : "bg-white text-slate-700 ring-1 ring-slate-200"
                          }`}
                        >
                          ❤️ Loved it
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleFav}
                          className={`flex-1 rounded-2xl px-3 py-3 text-sm font-bold transition ${
                            fav
                              ? "bg-rose-100 text-rose-700 ring-1 ring-rose-300"
                              : "bg-white text-slate-700 ring-1 ring-slate-200"
                          }`}
                        >
                          {fav ? "❤️ Saved" : "🤍 Save"}
                        </button>
                        <button
                          type="button"
                          onClick={handleShare}
                          className="flex-1 rounded-2xl bg-white px-3 py-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50"
                        >
                          📤 Share
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              ) : (
                <p className="text-center text-slate-600">No facts yet. Tap Next!</p>
              )}
              {error && fact && (
                <p className="mt-3 text-center text-xs text-amber-700">{error}</p>
              )}
            </div>
          </div>
        </section>

        {/* Giant Next button */}
        <div className="sticky bottom-0 mt-6 pt-2 pb-[env(safe-area-inset-bottom)]">
          <button
            type="button"
            disabled={loading}
            onClick={() => loadNext(fact?.id)}
            className="group relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-fuchsia-500 to-amber-500 px-6 py-5 text-2xl font-black uppercase tracking-wide text-white shadow-2xl shadow-violet-500/40 transition active:scale-[0.98] disabled:opacity-70 sm:py-6 sm:text-3xl"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              {loading ? "Thinking…" : "🔄 Next"}
              <span className="text-3xl transition group-hover:translate-x-1 sm:text-4xl">
                ➜
              </span>
            </span>
          </button>
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
