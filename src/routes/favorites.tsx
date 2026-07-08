import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Fact } from "@/lib/facts.functions";
import { getFavorites, toggleFavorite } from "@/lib/store";
import { emojiFor } from "@/lib/categories";

export const Route = createFileRoute("/favorites")({
  head: () => ({
    meta: [
      { title: "Favorites — Why?" },
      { name: "description", content: "Your saved 'Do you know why…' facts." },
      { name: "theme-color", content: "#7c3aed" },
    ],
  }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [facts, setFacts] = useState<Fact[]>([]);

  useEffect(() => {
    setFacts(getFavorites());
  }, []);

  const remove = (fact: Fact) => {
    toggleFavorite(fact);
    setFacts(getFavorites());
  };

  return (
    <main className="relative min-h-[100dvh] w-full">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            "linear-gradient(180deg, #fef3c7 0%, #ede9fe 100%)",
        }}
      />
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <span className="text-violet-700">Why</span>
            <span className="text-amber-500">?</span>
          </Link>
          <Link
            to="/"
            className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm"
          >
            ← Back
          </Link>
        </header>
        <h1 className="mb-4 text-2xl font-extrabold text-slate-900">❤️ Your Favorites</h1>

        {facts.length === 0 ? (
          <div className="rounded-3xl bg-white/85 p-8 text-center shadow-xl ring-1 ring-black/5 backdrop-blur">
            <p className="text-4xl">🤍</p>
            <p className="mt-3 text-slate-700">
              No favorites yet. Tap the heart on any fact to save it here!
            </p>
            <Link
              to="/"
              className="mt-5 inline-block rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white shadow"
            >
              Find a fact
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {facts.map((f) => (
              <li
                key={f.id}
                className="rounded-2xl bg-white/90 p-4 shadow-md ring-1 ring-black/5 backdrop-blur"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-xs font-bold uppercase tracking-widest text-amber-600">
                      {emojiFor(f.category)} Do you know why…
                    </p>
                    <p className="mt-1 text-base font-extrabold text-slate-900">
                      {f.question}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-slate-700">{f.answer}</p>
                    {f.fun_fact && (
                      <p className="mt-2 text-xs text-amber-700">⭐ {f.fun_fact}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(f)}
                    aria-label="Remove favorite"
                    className="shrink-0 rounded-full bg-rose-100 px-3 py-1 text-sm text-rose-700"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
