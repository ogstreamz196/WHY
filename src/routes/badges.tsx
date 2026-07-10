import { createFileRoute, redirect } from "@tanstack/react-router";

// Badges have been merged into the You (profile) page.
export const Route = createFileRoute("/badges")({
  beforeLoad: () => {
    throw redirect({ to: "/profile", hash: "achievements" });
  },
  component: () => null,
});
