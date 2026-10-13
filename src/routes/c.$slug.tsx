import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { getPublicChain, type PublicChain } from "@/lib/chains.functions";
import { STORE_CATALOG } from "@/lib/store";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/c/$slug")({
  loader: async ({ params }): Promise<PublicChain> => {
    const chain = await getPublicChain({ data: { slug: params.slug } });
    if (!chain) throw notFound();
    return chain;
  },
  head: ({ loaderData, params }) => {
    const title = loaderData?.title ?? "A “But why?” chain";
    const first = loaderData?.steps?.[0]?.question ?? "Follow the curiosity trail";
    const base = seo({
      title: `${title} | Why?`,
      description: first,
      path: `/c/${params.slug}`,
      type: "article",
    });
    // FAQ structured data: each step of the curiosity trail is a Q&A pair.
    const steps = (loaderData?.steps ?? []).filter((s) => s.question && s.answer);
    if (steps.length === 0) return base;
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: steps.map((s) => ({
              "@type": "Question",
              name: s.question,
              acceptedAnswer: { "@type": "Answer", text: s.answer },
            })),
          }),
        },
      ],
    };
  },
  errorComponent: () => (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white/80">
      <div>
        <p className="font-display text-2xl font-black">Something went wrong loading this chain.</p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-bold"
        >
          Open Why?
        </Link>
      </div>
    </main>
  ),
  notFoundComponent: () => (
    <main className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white/80">
      <div>
        <p className="font-display text-2xl font-black">
          This chain isn't shared (or was removed).
        </p>
        <Link
          to="/"
          className="mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-bold"
        >
          Explore Why?
        </Link>
      </div>
    </main>
  ),
  component: PublicChainPage,
});

function PublicChainPage() {
  const chain: PublicChain = Route.useLoaderData();
  const owner = chain.owner;
  const avatar = STORE_CATALOG.find((i) => i.id === owner?.avatar_id) ?? STORE_CATALOG[0];

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-16">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <div className="mb-4 flex items-center justify-between">
          <Link
            to="/"
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/80"
          >
            🤔 Why?
          </Link>
          <span className="text-[10px] font-black uppercase tracking-widest text-white/50">
            Shared chain
          </span>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong overflow-hidden rounded-4xl p-6"
        >
          <h1 className="font-display text-2xl font-black leading-tight text-white sm:text-3xl">
            {chain.title ?? "A curiosity trail"}
          </h1>
          <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
            <span
              className="flex h-7 w-7 items-center justify-center rounded-xl text-base"
              style={{ background: "var(--gradient-primary)" }}
            >
              {avatar?.emoji ?? "🌱"}
            </span>
            <span>
              by{" "}
              <span className="font-bold text-white/90">
                {owner?.display_name ?? "a curious explorer"}
              </span>
            </span>
          </div>

          <ol className="relative mt-6 space-y-4 pl-9">
            <span
              aria-hidden
              className="absolute left-3.5 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-fuchsia-500/60 via-violet-500/40 to-transparent"
            />
            {chain.steps.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
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
            Start your own curiosity journey
            <ArrowRight className="h-5 w-5" />
          </Link>
        </motion.article>
      </div>
    </main>
  );
}
