import { useRouterState } from "@tanstack/react-router";
import { useCurrentUser } from "@/lib/auth";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { AdultModeSwitch } from "@/components/AdultModeSwitch";

// Pages whose own header already shows the 18+ switch, or auth flows.
const HIDDEN_ON = ["/", "/home", "/adult", "/auth", "/auth/callback", "/reset-password", "/delete-account"];

/**
 * Keeps the 18+ switch in the header on every page for adults (website only).
 * Renders nothing in the apps or for anyone not confirmed 18+ by birthday.
 */
export function AdultHeaderBar() {
  const { user } = useCurrentUser();
  const { status, show } = useAdultStatus(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  if (!show || !user || !status || HIDDEN_ON.includes(pathname)) return null;
  return (
    <div className="relative z-40 flex justify-end px-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      <AdultModeSwitch on={status.mode_enabled} userId={user.id} size="sm" />
    </div>
  );
}
