import { createFileRoute } from "@tanstack/react-router";
import { WhyApp } from "@/components/WhyHome";
import { parseHomeSearch } from "./index";
import { DEFAULT_TITLE, seo } from "@/lib/site";

export const Route = createFileRoute("/home")({
  // Same page as "/" (kept so 18+ users can reach the kids' Home without the
  // redirect to /adult). Point search engines at "/" so it isn't a duplicate.
  head: () => seo({ title: DEFAULT_TITLE, path: "/" }),
  validateSearch: parseHomeSearch,
  component: HomePage,
});

function HomePage() {
  return <WhyApp routeSearch={Route.useSearch()} />;
}
