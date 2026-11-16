import { createFileRoute } from "@tanstack/react-router";
import { WhyApp, type HomeSearch } from "@/components/WhyHome";
import { DEFAULT_TITLE, seo } from "@/lib/site";

export const Route = createFileRoute("/home")({
  // Same page as "/" (kept so 18+ users can reach the kids' Home without the
  // redirect to /adult). Point search engines at "/" so it isn't a duplicate.
  head: () => seo({ title: DEFAULT_TITLE, path: "/" }),
  validateSearch: (s: Record<string, unknown>): HomeSearch => ({
    ...(s.welcome === "1" || s.welcome === 1 || s.welcome === true ? { welcome: true } : {}),
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.trim().slice(0, 200) } : {}),
  }),
  component: HomePage,
});

function HomePage() {
  return <WhyApp routeSearch={Route.useSearch()} />;
}
