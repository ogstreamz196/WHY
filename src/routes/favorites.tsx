import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import type { Fact } from "@/lib/facts.functions";
import { getFavorites, toggleFavorite } from "@/lib/store";
import { useCurrentUser } from "@/lib/auth";
import { emojiFor } from "@/lib/categories";
import { seo } from "@/lib/site";
import { asWhyQuestion } from "@/lib/whyQuestion";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { WhyLogo } from "@/components/WhyLogo";

export const Route = createFileRoute("/favorites")({
  head: () => seo({ title: "Favourites | Why?", noindex: true, themeColor: "#7c3aed" }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const [facts, setFacts] = useState<Fact[]>([]);
  const { user } = useCurrentUser();
  const navigate = useNavigate();

  useEffect(() => {
    setFacts(getFavorites());
  }, []);

  // Signed-in hearts are synced to the account and listed on /chains.
  useEffect(() => {
    if (user) navigate({ to: "/chains", replace: true });
  }, [user, navigate]);

  const remove = (fact: Fact) => {
    toggleFavorite(fact);
    setFacts(getFavorites());
  };

  return (
    <main className="relative min-h-[100dvh] w-full pb-28 wide:pb-8">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pb-8 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" aria-label="Why? home">
            <WhyLogo size={40} />
          </Link>
          <Link to="/" className="glass rounded-full px-3 py-1 text-sm font-semibold text-white/85">
            ← Back
          </Link>
        </header>
        <h1 className="mb-4 text-2xl font-black font-display text-white">❤️ Your Favourites</h1>

        {facts.length === 0 ? (
          <div className="glass rounded-3xl border border-white/10 p-8 text-center">
            <p className="text-4xl">🤍</p>
            <p className="mt-3 text-white/80">
              No favourites yet. Tap the heart on any fact to save it here!
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
              <li key={f.id} className="glass rounded-2xl border border-white/10 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <p className="text-base font-extrabold text-white">
                      <span aria-hidden className="mr-1.5">
                        {emojiFor(f.category)}
                      </span>
                      {asWhyQuestion(f.question)}
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-white/80">{f.answer}</p>
                    {f.fun_fact && (
                      <p className="mt-2 text-xs text-amber-200/90">⭐ {f.fun_fact}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(f)}
                    aria-label="Remove favourite"
                    className="shrink-0 rounded-full bg-rose-500/15 px-3 py-1 text-sm text-rose-200"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
