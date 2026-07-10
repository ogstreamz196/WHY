import { Link } from "@tanstack/react-router";
import { Home, Store, User, Sparkles, Medal, Crown } from "lucide-react";
import { useBossTheme } from "@/lib/useBossTheme";
import { useCurrentUser } from "@/lib/auth";
import { useSubscription } from "@/hooks/useSubscription";

const items = [
  { to: "/",            label: "Home",   Icon: Home },
  { to: "/chains",      label: "Chains", Icon: Sparkles },
  { to: "/leaderboard", label: "Ranks",  Icon: Medal },
  { to: "/store",       label: "Store",  Icon: Store },
  { to: "/profile",     label: "You",    Icon: User },
] as const;


export function BottomNav() {
  const isBoss = useBossTheme();
  const { user } = useCurrentUser();
  const { isVip } = useSubscription(user?.id);




  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)]"
    >
      <div className="mx-auto max-w-2xl px-3 pb-3">
        <div className="glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-[var(--shadow-card)]">
          {items.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ "data-active": "true" } as never}
              className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[var(--muted-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:text-white active:scale-90 data-[active=true]:text-foreground"
            >
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-2xl opacity-0 transition group-data-[active=true]:opacity-100"
                style={{ background: "var(--gradient-primary)", filter: "blur(14px)" }}
              />
              <span
                aria-hidden
                className="absolute inset-x-3 top-1 h-1 rounded-full opacity-0 transition group-data-[active=true]:opacity-100"
                style={{ background: "var(--gradient-primary)" }}
              />
              <Icon className="h-5 w-5 transition-transform duration-300 group-data-[active=true]:scale-110 group-hover:rotate-[-6deg]" strokeWidth={2.2} />
              <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide">
                {label === "You" && isBoss ? "Boss" : label}
                {label === "You" && isVip && (
                  <span
                    aria-label="VIP"
                    title="VIP member"
                    className="inline-flex items-center rounded-full border border-amber-300/70 bg-gradient-to-br from-amber-300 to-yellow-500 px-1 py-[1px] text-[7px] font-black text-amber-950 shadow-[0_0_6px_rgba(251,191,36,0.55)]"
                  >
                    <Crown className="h-2 w-2" strokeWidth={2.5} />
                  </span>
                )}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
