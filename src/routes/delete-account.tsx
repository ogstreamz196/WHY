import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { CosmicBackground } from "@/components/CosmicBackground";
import { deleteMyAccount } from "@/lib/account.functions";
import { useCurrentUser } from "@/lib/auth";

// Public page so it can be given to Google Play / the App Store as the
// "delete your account" link. Works on the web and inside the apps.
export const Route = createFileRoute("/delete-account")({
  head: () => ({
    meta: [
      { title: "Delete your account — Why?" },
      {
        name: "description",
        content: "How to permanently delete your Why? account and the data that goes with it.",
      },
    ],
  }),
  component: DeleteAccountPage,
});

function DeleteAccountPage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const remove = useServerFn(deleteMyAccount);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (typed.trim().toUpperCase() !== "DELETE") return;
    setError(null);
    setDeleting(true);
    try {
      await remove({ data: { confirm: "DELETE" } });
      await supabase.auth.signOut().catch(() => {});
      try {
        window.sessionStorage.clear();
      } catch {
        /* ignore */
      }
      toast.success("Your account has been deleted. Thanks for exploring with us.");
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account. Try again.");
      setDeleting(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-4 py-10">
      <CosmicBackground />
      <div className="glass-strong w-full max-w-md rounded-4xl border border-white/10 p-6 text-white">
        <h1 className="font-display text-2xl font-black">Delete your account</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Deleting your account is permanent. We remove your profile, coins, streaks, favourites,
          saved chains, quiz history, achievements and store items straight away, and you'll be
          signed out. A Why? Plus subscription bought on the website is cancelled at the same time.
          If you subscribed through the App Store or Google Play, cancel it there first; we can't
          cancel store subscriptions for you.
        </p>
        <p className="mt-2 text-sm leading-relaxed text-white/75">
          Payment records kept by our payment provider (Paddle) for tax and legal reasons are not
          removed by this. See our{" "}
          <Link to="/privacy" className="font-bold underline">
            privacy policy
          </Link>{" "}
          for details.
        </p>

        {loading ? (
          <div className="mt-6 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-white/60" />
          </div>
        ) : !user ? (
          <div className="mt-6 rounded-2xl bg-white/5 p-4 text-sm text-white/80">
            <p>Sign in to the account you want to delete, then come back to this page.</p>
            <Link
              to="/auth"
              search={{ mode: "signin" }}
              className="mt-3 inline-block rounded-full px-5 py-2 text-sm font-black text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              Sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleDelete} className="mt-6 space-y-3">
            <p className="text-xs text-white/60">
              Signed in as <span className="font-bold text-white/85">{user.email}</span>
            </p>
            <label className="block">
              <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/50">
                Type DELETE to confirm
              </span>
              <input
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                autoCapitalize="characters"
                autoComplete="off"
                className="w-full rounded-2xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm text-white outline-none focus:border-rose-400"
              />
            </label>
            {error && (
              <p className="rounded-xl bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={deleting || typed.trim().toUpperCase() !== "DELETE"}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-sm font-black text-white transition disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> Permanently delete my account
                </>
              )}
            </button>
            <Link to="/settings" className="block text-center text-xs text-white/60 underline">
              Cancel
            </Link>
          </form>
        )}
      </div>
    </main>
  );
}
