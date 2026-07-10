import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/auth";

// Occasionally prompt Gmail-address users (who signed up with email/password)
// to link their Google account. Linking merges identities on the same
// auth.users row, so all app data stays attached to the same user_id.
//
// Cadence rules (kept intentionally gentle):
//  - only if email ends with @gmail.com / @googlemail.com
//  - only if the user has no `google` identity yet
//  - dismissed → hidden for 14 days
//  - shown at most once every 3 app opens, capped at 5 total prompts

const DISMISS_DAYS = 14;
const OPENS_BETWEEN = 3;
const MAX_PROMPTS = 5;

function keyFor(uid: string, k: string) {
  return `why:linkgoogle:${uid}:${k}`;
}

function shouldShow(uid: string): boolean {
  try {
    const dismissedAt = Number(localStorage.getItem(keyFor(uid, "dismissedAt")) || 0);
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400_000) return false;
    const shown = Number(localStorage.getItem(keyFor(uid, "shown")) || 0);
    if (shown >= MAX_PROMPTS) return false;
    const opens = Number(localStorage.getItem(keyFor(uid, "opens")) || 0) + 1;
    localStorage.setItem(keyFor(uid, "opens"), String(opens));
    if (opens % OPENS_BETWEEN !== 0) return false;
    return true;
  } catch {
    return false;
  }
}

function markShown(uid: string) {
  try {
    const shown = Number(localStorage.getItem(keyFor(uid, "shown")) || 0) + 1;
    localStorage.setItem(keyFor(uid, "shown"), String(shown));
  } catch {
    /* noop */
  }
}

function markDismissed(uid: string) {
  try {
    localStorage.setItem(keyFor(uid, "dismissedAt"), String(Date.now()));
  } catch {
    /* noop */
  }
}

export function LinkGoogleBanner() {
  const { user } = useCurrentUser();
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const email = (user.email ?? "").toLowerCase();
    const isGmail = email.endsWith("@gmail.com") || email.endsWith("@googlemail.com");
    if (!isGmail) return;
    const hasGoogle = (user.identities ?? []).some((i) => i.provider === "google");
    if (hasGoogle) return;
    if (!shouldShow(user.id)) return;
    markShown(user.id);
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
    if (user) markDismissed(user.id);
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
