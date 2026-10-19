import { Link, useRouterState } from "@tanstack/react-router";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { useCurrentUser, useSignOut } from "@/lib/auth";

// Pages that must stay usable: deleting the account and reading the policy.
const OPEN_PATHS = ["/delete-account", "/privacy"];

/**
 * Accounts are 13+. The sign-up page checks this, but a Google or Apple
 * account can still be made from the sign-in page. When the birthday saved on
 * an account turns out to be under 13, this covers the site and offers to sign
 * out or delete the account. Website only: useAdultStatus never asks the server
 * inside the apps, where Google/Apple sign-in doesn't exist.
 */
export function UnderAgeNotice() {
  const { user } = useCurrentUser();
  const { status } = useAdultStatus(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const signOut = useSignOut();

  if (!user || !status?.under_13 || OPEN_PATHS.includes(pathname)) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="under-age-title"
      className="overlay-scroll fixed inset-0 z-[120] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md"
    >
      <div className="glass-strong w-full max-w-sm rounded-3xl border border-white/15 p-6 text-center shadow-[var(--shadow-card)]">
        <h2 id="under-age-title" className="font-display text-2xl font-black text-white">
          Accounts are for ages 13 and up
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          Sorry, you need to be 13 or older to have a Why? account. You can still explore facts
          without signing in.
        </p>
        <button
          type="button"
          onClick={() => {
            void signOut().then(() => window.location.assign("/"));
          }}
          className="mt-5 w-full rounded-full px-5 py-3 text-sm font-black text-white"
          style={{ background: "var(--gradient-primary)" }}
        >
          Sign out and keep exploring
        </button>
        <Link
          to="/delete-account"
          className="mt-2 block w-full rounded-full px-5 py-2.5 text-sm font-bold text-white/70 hover:text-white"
        >
          Delete this account
        </Link>
      </div>
    </div>
  );
}
