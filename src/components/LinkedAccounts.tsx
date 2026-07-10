import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { listMyLinkedIdentities } from "@/lib/account.functions";

/**
 * "Linked accounts" settings section.
 * Shows which OAuth providers are attached to the signed-in user
 * and offers a one-tap link button for Google when it isn't linked yet.
 */
export function LinkedAccounts() {
  const qc = useQueryClient();
  const list = useServerFn(listMyLinkedIdentities);
  const { data, isLoading } = useQuery({
    queryKey: ["linked-identities"],
    queryFn: () => list(),
    staleTime: 30_000,
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasGoogle = (data ?? []).some((i) => i.provider === "google");
  const googleEntry = (data ?? []).find((i) => i.provider === "google");

  async function linkGoogle() {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/settings` },
      });
      if (error) throw error;
      // Browser redirects to Google — nothing else to do here.
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Could not start linking.");
      setLoading(false);
      qc.invalidateQueries({ queryKey: ["linked-identities"] });
    }
  }

  return (
    <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
      <h2 className="mb-3 text-lg font-extrabold text-slate-900">🔗 Linked accounts</h2>
      <p className="mb-4 text-xs text-slate-600">
        Link a sign-in method to your account. Your progress, coins, and favourites stay on the same profile.
      </p>

      <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-white">
            <Link2 className="h-4 w-4" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Google</p>
            <p className="text-xs text-slate-600">
              {isLoading
                ? "Checking…"
                : hasGoogle
                  ? googleEntry?.email
                    ? `Linked · ${googleEntry.email}`
                    : "Linked"
                  : "Not linked yet"}
            </p>
          </div>
        </div>
        {hasGoogle ? (
          <span
            className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-700"
            aria-label="Google is linked"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> Linked
          </span>
        ) : (
          <button
            type="button"
            onClick={linkGoogle}
            disabled={loading || isLoading}
            className="rounded-full bg-slate-900 px-3 py-1.5 text-xs font-bold text-white hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Linking…" : "Link Google"}
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-xs font-semibold text-rose-600">{error}</p>}
    </section>
  );
}

export default LinkedAccounts;
