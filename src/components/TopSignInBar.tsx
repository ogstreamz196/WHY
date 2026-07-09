import { Link } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth";

export function TopSignInBar() {
  const { user, loading } = useCurrentUser();
  if (loading || user) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-end px-3 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <Link
        to="/auth"
        search={{ mode: "signin" }}
        className="pointer-events-auto rounded-full px-4 py-2 text-xs font-black text-white shadow-[var(--shadow-glow)] active:scale-95"
        style={{ background: "var(--gradient-primary)" }}
      >
        Sign in
      </Link>
    </div>
  );
}
