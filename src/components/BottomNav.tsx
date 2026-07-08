import { Link } from "@tanstack/react-router";
import { Home, Search, Heart, Trophy, Settings } from "lucide-react";

const items = [
  { to: "/",          label: "Home",      Icon: Home },
  { to: "/favorites", label: "Favorites", Icon: Heart },
  { to: "/badges",    label: "Badges",    Icon: Trophy },
  { to: "/settings",  label: "Settings",  Icon: Settings },
] as const;

export function BottomNav() {
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
              className="group relative flex flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[var(--muted-foreground)] transition data-[active=true]:text-foreground"
            >
              <span
                aria-hidden
                className="absolute inset-0 -z-10 rounded-2xl opacity-0 transition group-data-[active=true]:opacity-100"
                style={{ background: "var(--gradient-primary)", filter: "blur(14px)", opacity: 0 }}
              />
              <span
                aria-hidden
                className="absolute inset-x-3 top-1 h-1 rounded-full opacity-0 transition group-data-[active=true]:opacity-100"
                style={{ background: "var(--gradient-primary)" }}
              />
              <Icon className="h-5 w-5" strokeWidth={2.2} />
              <span className="text-[10px] font-semibold tracking-wide">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
