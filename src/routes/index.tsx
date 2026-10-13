import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { WhyApp, type HomeSearch } from "@/components/WhyHome";
import { useCurrentUser } from "@/lib/auth";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { DEFAULT_TITLE, seo } from "@/lib/site";

export function parseHomeSearch(s: Record<string, unknown>): HomeSearch {
  return {
    ...(s.welcome === "1" || s.welcome === 1 || s.welcome === true ? { welcome: true } : {}),
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.trim().slice(0, 200) } : {}),
  };
}

export const Route = createFileRoute("/")({
  head: () => seo({ title: DEFAULT_TITLE, path: "/" }),
  // ?q= opens search with that question (used by Google's search box).
  validateSearch: parseHomeSearch,
  component: IndexPage,
});

function IndexPage() {
  const routeSearch = Route.useSearch();
  const { user } = useCurrentUser();
  const adult = useAdultStatus(user?.id);
  const navigate = useNavigate();
  // With 18+ mode on (website, adults only) the 18+ page replaces Home.
  const adultOn = adult.show && !!adult.status?.mode_enabled;
  useEffect(() => {
    if (adultOn) navigate({ to: "/adult", replace: true });
  }, [adultOn, navigate]);
  return <WhyApp routeSearch={routeSearch} />;
}
