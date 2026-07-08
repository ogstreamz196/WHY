import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2, Sparkles } from "lucide-react";
import { useEffect } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useCurrentUser } from "@/lib/auth";
import { getChain } from "@/lib/chains.functions";

export const Route = createFileRoute("/chain/$id")({
  head: () => ({ meta: [{ title: "Why chain" }] }),
  component: ChainDetailPage,
});

function ChainDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const { user, loading } = useCurrentUser();
  const fetchChain = useServerFn(getChain);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: `/chain/${id}` } });
  }, [user, loading, navigate, id]);

  const chain = useQuery({
    queryKey: ["chain", id],
    queryFn: () => fetchChain({ data: { id } }),
    enabled: !!user,
  });

  if (loading || chain.isLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }
  if (!chain.data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white/80">
        <div>
          <p className="font-display text-xl font-black">Chain not found.</p>
          <Link to="/chains" className="mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-bold">
            Back to chains
          </Link>
        </div>
      </main>
    );
  }

  const c = chain.data;

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          to="/chains"
          className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All chains
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong mt-4 overflow-hidden rounded-4xl p-6"
        >
          <h1 className="font-display text-2xl font-black leading-tight text-white sm:text-3xl">
            {c.title ?? "Untitled chain"}
          </h1>
          <p className="mt-1 text-xs text-white/50">
            {c.steps.length} step{c.steps.length === 1 ? "" : "s"}
            {c.is_public && c.share_slug && (
              <>
                {" · "}
                <span className="text-cyan-200">public /c/{c.share_slug}</span>
              </>
            )}
          </p>

          <ol className="relative mt-6 space-y-4 pl-9">
            <span
              aria-hidden
              className="absolute left-3.5 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-fuchsia-500/60 via-violet-500/40 to-transparent"
            />
            {c.steps.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <span
                  className="absolute -left-9 top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white shadow-lg"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {i + 1}
                </span>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-bold leading-snug text-white">{s.question}</p>
                  {s.answer && (
                    <p className="mt-1.5 text-xs leading-relaxed text-white/70">{s.answer}</p>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>

          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-2 rounded-full px-5 py-4 text-base font-black text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-5 w-5" />
            Keep exploring
          </Link>
        </motion.article>
      </div>
      <BottomNav />
    </main>
  );
}
