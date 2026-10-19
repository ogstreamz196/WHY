import { createFileRoute, Link, notFound, redirect } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Share2, Sparkles } from "lucide-react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { WhyLogo } from "@/components/WhyLogo";
import { getFactPage, type FactPage } from "@/lib/factPages.functions";
import { CATEGORIES, emojiFor, gradientFor } from "@/lib/categories";
import { asWhyQuestion } from "@/lib/whyQuestion";
import {
  SITE_NAME,
  SITE_URL,
  LOGO_URL,
  codeFromFactSlug,
  factPath,
  factSlug,
  seo,
} from "@/lib/site";

// A page for every fact, so each "why" question can be found on Google and
// shared with a proper preview. Only kid-safe facts exist here.
export const Route = createFileRoute("/fact/$slug")({
  loader: async ({ params }): Promise<FactPage> => {
    const code = codeFromFactSlug(params.slug);
    if (!code) throw notFound();
    const page = await getFactPage({ data: { code } });
    if (!page) throw notFound();
    // One address per fact: send old or mistyped slugs to the right one.
    const canonical = factSlug(page.fact.question, page.fact.code);
    if (params.slug !== canonical) {
      throw redirect({ to: "/fact/$slug", params: { slug: canonical }, statusCode: 301 });
    }
    return page;
  },
  head: ({ loaderData }) => {
    if (!loaderData) return seo({ title: `Fact not found | ${SITE_NAME}`, noindex: true });
    const { fact } = loaderData;
    const question = asWhyQuestion(fact.question);
    const path = factPath(fact.question, fact.code);
    const category = categoryLabel(fact.category);
    const base = seo({
      title: `${question} | ${SITE_NAME}`,
      description: `${fact.answer}${fact.fun_fact ? ` Bonus: ${fact.fun_fact}` : ""}`,
      path,
      type: "article",
    });
    const jsonLd = [
      {
        "@context": "https://schema.org",
        "@type": "Article",
        headline: question,
        description: fact.answer,
        articleSection: category,
        inLanguage: "en",
        mainEntityOfPage: `${SITE_URL}${path}`,
        ...(fact.created_at ? { datePublished: fact.created_at } : {}),
        isAccessibleForFree: true,
        audience: { "@type": "Audience", audienceType: "Kids, families and classrooms" },
        publisher: {
          "@type": "Organization",
          name: SITE_NAME,
          logo: { "@type": "ImageObject", url: LOGO_URL },
        },
      },
      {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
          { "@type": "ListItem", position: 2, name: question, item: `${SITE_URL}${path}` },
        ],
      },
    ];
    return {
      ...base,
      scripts: [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }],
    };
  },
  notFoundComponent: () => (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-6 text-center text-white">
      <CosmicBackground />
      <div className="glass-strong max-w-md rounded-4xl p-8">
        <p className="font-display text-2xl font-black">We couldn't find that fact.</p>
        <Link
          to="/"
          className="mt-5 inline-block rounded-full px-5 py-2.5 text-sm font-bold text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          Explore more facts
        </Link>
      </div>
    </main>
  ),
  component: FactPageView,
});

function categoryLabel(key: string | null): string {
  return CATEGORIES.find((c) => c.key === key)?.label ?? "Fun facts";
}

function FactPageView() {
  const { fact, related } = Route.useLoaderData();
  const question = asWhyQuestion(fact.question);

  async function share() {
    const url = `${SITE_URL}${factPath(fact.question, fact.code)}`;
    try {
      if (navigator.share) await navigator.share({ title: question, text: `🤔 ${question}`, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      /* cancelled */
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full pb-16">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link to="/" aria-label="Why? home">
            <WhyLogo size={40} withWordmark />
          </Link>
          <Link
            to="/"
            className="rounded-full px-4 py-2 text-sm font-black text-white shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            Play Why?
          </Link>
        </header>

        <nav aria-label="Breadcrumb" className="mb-3 text-xs font-bold text-white/60">
          <Link to="/" className="hover:text-white">
            {SITE_NAME}
          </Link>{" "}
          / <span>{categoryLabel(fact.category)}</span>
        </nav>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong relative overflow-hidden rounded-4xl p-6 sm:p-8"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 opacity-40 blur-3xl"
            style={{ background: gradientFor(fact.category) }}
          />
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-white/80">
            <span aria-hidden>{emojiFor(fact.category)}</span> {categoryLabel(fact.category)}
          </p>
          <h1 className="mt-3 font-fun text-[clamp(1.9rem,6vw,3rem)] font-bold leading-[1.1] text-white [text-wrap:balance]">
            {question}
          </h1>
          <p className="mt-4 text-[clamp(1.05rem,2.8vw,1.25rem)] leading-relaxed text-white/90">
            {fact.answer}
          </p>
          {fact.fun_fact && (
            <p className="mt-4 rounded-2xl border border-yellow-300/25 bg-yellow-300/10 p-4 text-base text-yellow-50">
              <span className="font-black">⭐ Bonus fact: </span>
              {fact.fun_fact}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-2">
            <Link
              to="/"
              search={{ q: fact.question }}
              className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-4 w-4" /> Ask “But why?” in the app
            </Link>
            <button
              type="button"
              onClick={share}
              className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-3 text-sm font-black text-white"
            >
              <Share2 className="h-4 w-4" /> Share
            </button>
          </div>
        </motion.article>

        {related.length > 0 && (
          <section className="mt-8" aria-labelledby="more-facts">
            <h2 id="more-facts" className="mb-3 font-display text-xl font-black text-white">
              More {categoryLabel(fact.category).toLowerCase()} facts
            </h2>
            <ul className="grid gap-2 sm:grid-cols-2">
              {related.map((r) => (
                <li key={r.id}>
                  <Link
                    to="/fact/$slug"
                    params={{ slug: factSlug(r.question, r.code) }}
                    className="glass flex items-center justify-between gap-3 rounded-2xl p-4 text-sm font-bold text-white hover:bg-white/10"
                  >
                    <span>{asWhyQuestion(r.question)}</span>
                    <ArrowRight className="h-4 w-4 shrink-0 text-white/60" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="mt-10 text-center text-sm text-white/60">
          {SITE_NAME} answers kids' biggest “why” questions with short, true and fun facts.{" "}
          <Link to="/" className="font-bold text-white underline">
            Start exploring
          </Link>
        </p>
      </div>
    </main>
  );
}
