import { Link, useRouterState } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { useCurrentUser } from "@/lib/auth";
import { getSeen } from "@/lib/store";

// Only Home: elsewhere (fact pages people reach from Google, the store…) the
// strip just takes space before the content.
const SHOWN_ON = ["/", "/home"];
/** Guests see it once they've read a few facts, so it's worth saving them. */
const MIN_FACTS = 3;
const DISMISS_KEY = "why:syncBarDismissedAt";
/** A closed strip comes back after a week. */
const DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function dismissedRecently(): boolean {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY));
    return Number.isFinite(at) && at > 0 && Date.now() - at < DISMISS_MS;
  } catch {
    return false;
  }
}

/**
 * Slim sign-in strip for guests. It sits in the page flow (not floating) so it
 * never covers page headers, coin balances or buttons.
 */
export function TopSignInBar() {
  const { user, loading } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [seen, setSeen] = useState(0);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setSeen(getSeen());
    setDismissed(dismissedRecently());
    const onSeen = () => setSeen(getSeen());
    window.addEventListener("why:seen", onSeen);
    return () => window.removeEventListener("why:seen", onSeen);
  }, []);

  if (loading || user || dismissed || seen < MIN_FACTS || !SHOWN_ON.includes(pathname)) {
    return null;
  }
  const close = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* private mode: it just comes back next visit */
    }
  };
  return (
    <div className="relative z-40 flex items-center justify-between gap-2 border-b border-white/10 bg-black/40 px-4 pb-2 wide:pl-[calc(var(--rail-w)+1rem)] pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur short:pb-1 short:pt-1">
      <p className="text-xs font-semibold text-white/75">
        Your {seen} facts are saved on this device only. Sign up to keep them everywhere.
      </p>
      <div className="flex shrink-0 items-center gap-1">
        <Link
          to="/auth"
          search={{ mode: "signup" }}
          className="shrink-0 rounded-full px-4 py-1.5 text-xs short:py-1 font-black text-white shadow-[var(--shadow-glow)] active:scale-95"
          style={{ background: "var(--gradient-primary)" }}
        >
          Sign up
        </Link>
        <button
          type="button"
          onClick={close}
          aria-label="Close"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/60 hover:bg-white/10"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
