import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { NotFoundCard } from "@/components/NotFoundCard";
import { WhyLogo } from "@/components/WhyLogo";
import { CATEGORIES, gradientFor } from "@/lib/categories";
import { listTopicFacts, type PublicFact } from "@/lib/factPages.functions";
import { SITE_NAME, SITE_URL, factSlug, seo } from "@/lib/site";
import { asWhyQuestion } from "@/lib/whyQuestion";

// One page per topic (Animals, Space…), listing all its facts: linked from
// each fact page's breadcrumb, and another way for Google to find them.
export const Route = createFileRoute("/topic/$key")({
  loader: async ({ params }) => {
    const topic = CATEGORIES.find((c) => c.key === params.key && c.key !== "all");
    if (!topic) throw notFound();
    const facts = await listTopicFacts({ data: { key: topic.key } });
    return { key: topic.key, label: topic.label, emoji: topic.emoji, facts };
  },
  head: ({ loaderData, params }) => {
    const label = loaderData?.label ?? "Topic";
    const base = seo({
      title: `${label} facts for curious kids | ${SITE_NAME}`,
      description: `${loaderData?.facts.length ?? "Lots of"} short, true answers to kids' "why" questions about ${label.toLowerCase()}.`,
      path: `/topic/${params.key}`,
    });
    return {
      ...base,
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: SITE_NAME, item: SITE_URL },
              {
                "@type": "ListItem",
                position: 2,
                name: label,
                item: `${SITE_URL}/topic/${params.key}`,
              },
            ],
          }),
        },
      ],
    };
  },
  notFoundComponent: () => (
    <NotFoundCard title="We couldn't find that topic" message="Try one of the topics on Home." />
  ),
  component: TopicPage,
});

function TopicPage() {
  const { key, label, emoji, facts } = Route.useLoaderData();
  return (
    <main className="relative min-h-[100dvh] w-full pb-28 wide:pb-8">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-5 flex items-center justify-between">
          <Link to="/" aria-label="Why? home">
            <WhyLogo size={40} withWordmark />
          </Link>
        </header>
        <nav aria-label="Breadcrumb" className="mb-3 text-xs font-bold text-white/60">
          <Link to="/" className="hover:text-white">
            {SITE_NAME}
          </Link>{" "}
          / <span>{label}</span>
        </nav>
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl shadow-lg"
            style={{ background: gradientFor(key) }}
          >
            {emoji}
          </span>
          <div>
            <h1 className="font-display text-3xl font-black text-white">{label} facts</h1>
            <p className="text-sm text-white/60">
              {facts.length} {facts.length === 1 ? "question" : "questions"} answered
            </p>
          </div>
        </div>
        {facts.length === 0 ? (
          <p className="glass mt-6 rounded-2xl p-4 text-sm text-white/70">
            No facts in this topic yet.
          </p>
        ) : (
          <ul className="mt-6 grid gap-2 sm:grid-cols-2">
            {facts.map((f: PublicFact) => (
              <li key={f.id}>
                <Link
                  to="/fact/$slug"
                  params={{ slug: factSlug(f.question, f.code) }}
                  className="glass flex h-full items-center justify-between gap-3 rounded-2xl p-4 text-sm font-bold text-white hover:bg-white/10"
                >
                  <span>{asWhyQuestion(f.question)}</span>
                  <ArrowRight aria-hidden className="h-4 w-4 shrink-0 text-white/60" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
