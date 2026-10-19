import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/CosmicBackground";
import { seo } from "@/lib/site";
import { needsNickname } from "@/lib/nickname";
import { hasGuestFavorites } from "@/lib/guestImport";

export const Route = createFileRoute("/auth/callback")({
  head: () => seo({ title: "Signing you in… | Why?", noindex: true }),
  component: AuthCallback,
});

function baseDestination(): string {
  // Guest progress lives in localStorage (src/lib/store.ts); only favourites
  // move to the account, so only they are worth an import screen.
  if (hasGuestFavorites()) return `/import-guest?redirect=${encodeURIComponent("/?welcome=1")}`;
  return "/";
}

async function destinationFor(userId: string, email: string | null | undefined): Promise<string> {
  const base = baseDestination();
  // Guest import flow already carries the welcome flag; don't double-decide.
  if (base.startsWith("/import-guest")) return base;
  try {
    const { data } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("id", userId)
      .maybeSingle();
    return needsNickname(data?.display_name, email, userId) ? "/?welcome=1" : "/";
  } catch {
    // If profile lookup fails, fall through to home — the overlay on `/` still
    // opens for missing nicknames as a safety net.
    return "/";
  }
}

function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    const go = async (userId: string, email: string | null | undefined) => {
      if (cancelled) return;
      const dest = await destinationFor(userId, email);
      if (cancelled) return;
      window.location.replace(dest);
    };

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        void go(data.session.user.id, data.session.user.email);
        return;
      }
      const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
        if (session || event === "SIGNED_IN") {
          sub.subscription.unsubscribe();
          if (session) void go(session.user.id, session.user.email);
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
