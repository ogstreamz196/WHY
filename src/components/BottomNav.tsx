import { Link } from "@tanstack/react-router";
import { Home, Trophy, Store, User, Sparkles, Medal } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const BOSS_EMAIL = "ogstreamz196@gmail.com";

const items = [
  { to: "/",            label: "Home",   Icon: Home },
  { to: "/chains",      label: "Chains", Icon: Sparkles },
  { to: "/leaderboard", label: "Ranks",  Icon: Medal },
  { to: "/store",       label: "Store",  Icon: Store },
  { to: "/badges",      label: "Badges", Icon: Trophy },
  { to: "/profile",     label: "You",    Icon: User },
] as const;


export function BottomNav() {
  const [isBoss, setIsBoss] = useState(false);
  useEffect(() => {
    let alive = true;
    const apply = (boss: boolean) => {
      if (!alive) return;
      setIsBoss(boss);
      document.documentElement.classList.toggle("theme-boss", boss);
    };
    supabase.auth.getUser().then(({ data }) => {
      apply(data.user?.email?.toLowerCase() === BOSS_EMAIL);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session?.user?.email?.toLowerCase() === BOSS_EMAIL);
    });
    return () => { alive = false; sub.subscription.unsubscribe(); };
  }, []);


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
              <span className="text-[10px] font-semibold tracking-wide">{label === "You" && isBoss ? "Boss" : label}</span>
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
}
