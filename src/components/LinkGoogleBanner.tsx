import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";
import { shouldShow, markShown, markDismissed } from "@/lib/linkGoogleCadence";

// Occasionally prompt Gmail-address users (who signed up with email/password)
// to link their Google account. Linking merges identities on the same
// auth.users row, so all app data stays attached to the same user_id.
// Cadence & cap logic lives in `linkGoogleCadence.ts` (unit tested).

export function LinkGoogleBanner() {
  const { user } = useCurrentUser();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const email = (user.email ?? "").toLowerCase();
    const isGmail = email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
    if (!isGmail) return;
    const hasGoogle = (user.identities ?? []).some((i) => i.provider === "google");
    if (hasGoogle) return;
    if (!shouldShow(user.id, window.localStorage)) return;
    markShown(user.id, window.localStorage);
    setVisible(true);
  }, [user]);

  async function onLink() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      // linkIdentity attaches Google to the current auth.users row.
      // Requires "Manual Linking" enabled in Supabase Auth settings.
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/` },
      });
      if (error) throw error;
      // Redirect happens; nothing else to do.
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Could not link Google.";
      setError(msg);
      setLoading(false);
    }
  }

  function onDismiss() {
    if (user && typeof window !== "undefined") markDismissed(user.id, window.localStorage);
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          className="mx-auto mb-3 flex w-full max-w-xl items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 shadow-sm backdrop-blur"
          role="region"
          aria-label="Link Google account"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-amber-400 to-pink-500 text-white">
            <Sparkles className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">Link your Google account</p>
            <p className="truncate text-xs opacity-80">
              {error ?? "One-tap sign-in next time, same profile & progress."}
            </p>
          </div>
          <button
            type="button"
            onClick={onLink}
            disabled={loading}
            className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90 disabled:opacity-60"
          >
            {loading ? "Linking…" : "Link"}
          </button>
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Dismiss"
            className="rounded-full p-1 opacity-70 hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            <X className="h-4 w-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default LinkGoogleBanner;
