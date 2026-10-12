import { Link, useRouterState } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth";

// Pages where the strip would duplicate or interrupt an auth flow.
const HIDDEN_ON = [
  "/auth",
  "/auth/callback",
  "/reset-password",
  "/delete-account",
];

/**
 * Slim sign-in strip for guests. It sits in the page flow (not floating) so it
 * never covers page headers, coin balances or buttons.
 */
export function TopSignInBar() {
  const { user, loading } = useCurrentUser();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (loading || user || HIDDEN_ON.includes(pathname)) return null;
  return (
    <div className="relative z-40 flex items-center justify-between gap-3 border-b border-white/10 bg-black/40 px-4 pb-2 pt-[max(0.5rem,env(safe-area-inset-top))] backdrop-blur">
      <p className="text-xs font-semibold text-white/75">
        Saved on this device · Sign in to sync across devices
      </p>
      <Link
        to="/auth"
        search={{ mode: "signin" }}
        className="shrink-0 rounded-full px-4 py-1.5 text-xs font-black text-white shadow-[var(--shadow-glow)] active:scale-95"
        style={{ background: "var(--gradient-primary)" }}
      >
        Sign in / Sign up
      </Link>
    </div>
  );
}
