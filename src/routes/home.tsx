import { createFileRoute } from "@tanstack/react-router";
import { WhyApp, type HomeSearch } from "@/components/WhyHome";
import { DEFAULT_TITLE, seo } from "@/lib/site";

export const Route = createFileRoute("/home")({
  head: () => seo({ title: DEFAULT_TITLE, path: "/home" }),
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    ...(s.welcome === "1" || s.welcome === 1 || s.welcome === true ? { welcome: true } : {}),
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.trim().slice(0, 200) } : {}),
  }),
  component: HomePage,
});

function HomePage() {
  return <WhyApp routeSearch={Route.useSearch()} />;
}
