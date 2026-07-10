import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/CosmicBackground";

export const Route = createFileRoute("/auth/callback")({
  head: () => ({
    meta: [
      { title: "Signing you in… — Why?" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthCallback,
});

function nextDestination(): string {
  try {
    const store = typeof window !== "undefined" ? window.sessionStorage : null;
    const hasGuest =
      !!store &&
      ((Number(store.getItem("why:points")) || 0) > 0 ||
        (Number(store.getItem("why:streak")) || 0) > 0 ||
        (JSON.parse(store.getItem("why:favorites") ?? "[]") as unknown[]).length > 0);
    if (hasGuest) return `/import-guest?redirect=${encodeURIComponent("/")}`;
  } catch {
    // ignore
  }
  return "/";
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const go = () => {
      if (cancelled) return;
      window.location.replace(nextDestination());
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        go();
        return;
      }
      // Wait briefly for the OAuth response to hydrate the session.
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session || event === "SIGNED_IN") {
          sub.subscription.unsubscribe();
          go();
        }
      });
      timeout = setTimeout(() => {
        sub.subscription.unsubscribe();
        if (cancelled) return;
        setError("We couldn't finish signing you in. Please try again.");
        setTimeout(() => navigate({ to: "/auth" }), 1500);
      }, 8000);
    });

    return () => {
      cancelled = true;
      if (timeout) clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-4">
      <CosmicBackground />
      <div className="glass-strong rounded-4xl px-8 py-6 text-center">
        {error ? (
          <p className="text-sm font-semibold text-rose-300">{error}</p>
        ) : (
          <div className="flex items-center gap-3 text-white">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-bold">Signing you in…</span>
          </div>
        )}
      </div>
    </main>
  );
}
