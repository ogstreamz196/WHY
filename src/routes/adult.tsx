import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Apple, Check, Loader2, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useCurrentUser } from "@/lib/auth";
import {
  getAdultStatus,
  verifyAdult,
  listAdultFacts,
  revokeAdultVerification,
} from "@/lib/adult.functions";

export const Route = createFileRoute("/adult")({
  head: () => ({
    meta: [
      { title: "18+ mode — Why?" },
      { name: "description", content: "Adults-only curiosity, gated by age verification." },
      { name: "robots", content: "noindex" },
      { name: "theme-color", content: "#100c1f" },
    ],
  }),
  component: AdultPage,
});

function GoogleGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        fill="#4285F4"
        d="M23 12.3c0-.9-.1-1.6-.2-2.3H12v4.3h6.2c-.1.9-.9 2.4-2.5 3.5l-.02.15 3.6 2.8.25.02c2.3-2.1 3.5-5.2 3.5-8.5z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.3 0 6-1.1 8-3l-3.8-3c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.9-5.1H1.2v3.1C3.2 21 7.3 24 12 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.1 14.1c-.3-.7-.4-1.5-.4-2.1 0-.7.1-1.4.4-2.1V6.8H1.2C.4 8.3 0 10.1 0 12s.4 3.7 1.2 5.2l3.9-3.1z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c2.3 0 3.8 1 4.7 1.8l3.4-3.3C18 1.2 15.3 0 12 0 7.3 0 3.2 3 1.2 6.8l3.9 3c1-3 3.7-5 6.9-5z"
      />
    </svg>
  );
}

function AdultPage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchStatus = useServerFn(getAdultStatus);
  const doVerify = useServerFn(verifyAdult);
  const doRevoke = useServerFn(revokeAdultVerification);
  const fetchFacts = useServerFn(listAdultFacts);

  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [linking, setLinking] = useState<"google" | "apple" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { mode: "signin", redirect: "/adult" } });
    }
  }, [user, loading, navigate]);

  const status = useQuery({
    queryKey: ["adult-status"],
    queryFn: () => fetchStatus(),
    enabled: !!user,
  });

  const facts = useInfiniteQuery({
    queryKey: ["adult-facts"],
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchFacts({ data: { limit: 10, offset: pageParam as number } }),
    getNextPageParam: (last) => (last.hasMore ? last.nextOffset : undefined),
    enabled: !!status.data?.verified,
  });

  const verify = useMutation({
    mutationFn: () => doVerify({ data: { confirm_over_18: true } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adult-status"] }),
    onError: (e: Error) => setError(e.message),
  });

  const revoke = useMutation({
    mutationFn: () => doRevoke(),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["adult-status"] }),
  });

  async function linkProvider(provider: "google" | "apple") {
    setError(null);
    setLinking(provider);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/adult`,
      });
      if (result.error) setError(`${provider === "google" ? "Google" : "Apple"} sign-in failed.`);
    } finally {
      setLinking(null);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }

  const s = status.data;
  const items = facts.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="flex items-center justify-between gap-3">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-rose-200">
              <AlertTriangle className="h-3 w-3" /> 18+ only
            </div>
            <h1 className="mt-2 font-display text-3xl font-black text-white">Grown-up curiosity</h1>
            <p className="text-sm text-white/60">
              Facts and topics we keep out of the kid-safe feed. Age-gated, no politics.
            </p>
          </div>
          <Link to="/" className="text-xs font-bold text-white/60">
            ← Home
          </Link>
        </header>

        {!s || status.isLoading ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-white/60" />
          </div>
        ) : s.verified ? (
          <>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-strong mt-5 flex items-center gap-3 rounded-3xl border border-emerald-400/20 p-4"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-black text-white">Age verified</div>
                <div className="text-[11px] text-white/60">
                  via {s.provider ?? "verified provider"}
                  {s.verified_at && ` · ${new Date(s.verified_at).toLocaleDateString()}`}
                </div>
              </div>
              <button
                type="button"
                onClick={() => revoke.mutate()}
                disabled={revoke.isPending}
                className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/70"
              >
                {revoke.isPending ? "…" : "Revoke"}
              </button>
            </motion.div>

            <section className="mt-6 space-y-3">
              {items.length === 0 && !facts.isLoading && (
                <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                  No 18+ facts published yet. Check back soon.
                </p>
              )}
              {items.map((f, i) => (
                <motion.article
                  key={f.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i, 8) * 0.03 }}
                  className="glass rounded-3xl border border-white/10 p-5"
                >
                  <div className="text-[10px] font-black uppercase tracking-widest text-rose-300/80">
                    {f.category ?? "adult"}
                  </div>
                  <h2 className="mt-1 font-display text-xl font-black text-white">
                    Do you know why {f.question}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-white/85">{f.answer}</p>
                  {f.fun_fact && (
                    <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-xs text-white/70">
                      <span className="mr-1 font-black text-fuchsia-300">Bonus:</span>
                      {f.fun_fact}
                    </div>
                  )}
                </motion.article>
              ))}
              {facts.hasNextPage && (
                <button
                  type="button"
                  onClick={() => facts.fetchNextPage()}
                  disabled={facts.isFetchingNextPage}
                  className="w-full rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-bold text-white/80"
                >
                  {facts.isFetchingNextPage ? "Loading…" : "Load more"}
                </button>
              )}
            </section>
          </>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-strong mt-6 rounded-4xl border border-white/10 p-6"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/20 text-rose-200">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div>
                <h2 className="font-display text-xl font-black text-white">Verify you're 18+</h2>
                <p className="text-xs text-white/60">
                  We use your Google or Apple account as proof of a verified adult identity.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3">
              <input
                type="checkbox"
                checked={ageConfirmed}
                onChange={(e) => setAgeConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-rose-400"
              />
              <span className="text-xs leading-relaxed text-white/80">
                I confirm I am 18 years or older and understand this section may contain content
                unsuitable for children.
              </span>
            </label>

            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => linkProvider("google")}
                disabled={!ageConfirmed || !!linking}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-white/95 px-4 py-3 text-sm font-black text-gray-900 disabled:opacity-40"
              >
                {linking === "google" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleGlyph />
                )}
                Continue with Google
              </button>
              <button
                type="button"
                onClick={() => linkProvider("apple")}
                disabled={!ageConfirmed || !!linking}
                className="flex items-center justify-center gap-2 rounded-full border border-white/15 bg-black px-4 py-3 text-sm font-black text-white disabled:opacity-40"
              >
                {linking === "apple" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Apple className="h-4 w-4" />
                )}
                Continue with Apple
              </button>
            </div>

            <button
              type="button"
              onClick={() => verify.mutate()}
              disabled={!ageConfirmed || verify.isPending}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-40"
              style={{ background: "var(--gradient-primary)" }}
            >
              {verify.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              I'm already signed in with Google or Apple — verify me
            </button>

            <AnimatePresence>
              {error && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="mt-3 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-3 text-xs text-rose-200"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>

            <p className="mt-4 text-[10px] leading-relaxed text-white/40">
              We store only your verification timestamp and the provider name. No ID document, no
              biometric data.
            </p>
          </motion.div>
        )}

        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[11px] font-bold text-white/60"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
