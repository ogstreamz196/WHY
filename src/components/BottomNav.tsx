import { Link } from "@tanstack/react-router";
import {
  Home,
  Store,
  User,
  Sparkles,
  Medal,
  Crown,
  ArrowLeft,
  ArrowRight,
  Settings,
} from "lucide-react";
import { WhyLogo } from "@/components/WhyLogo";
import { useMemo } from "react";
import { useBossTheme } from "@/lib/useBossTheme";
import { useCurrentUser } from "@/lib/auth";
import { usePlus } from "@/hooks/usePlus";
import { useEditMode } from "@/lib/editMode";
import { EditableText } from "@/components/EditableText";
import { useAdultStatus } from "@/hooks/useAdultStatus";

const ICONS = { Home, Store, User, Sparkles, Medal } as const;
type IconKey = keyof typeof ICONS;

const DEFAULT_ITEMS: { to: string; label: string; icon: IconKey }[] = [
  { to: "/", label: "Home", icon: "Home" },
  { to: "/chains", label: "Favourites", icon: "Sparkles" },
  { to: "/leaderboard", label: "Ranks", icon: "Medal" },
  { to: "/store", label: "Store", icon: "Store" },
  { to: "/profile", label: "You", icon: "User" },
];

const NAV_ORDER_KEY = "nav.bottom.order";

export function BottomNav() {
  const isBoss = useBossTheme();
  const { user } = useCurrentUser();
  const { isPlus: isVip } = usePlus(user?.id);
  const { editMode, overrides, saveOverride } = useEditMode();
  const adult = useAdultStatus(user?.id);
  // 18+ mode on (website only): the Home tab opens the 18+ page instead.
  const adultOn = adult.show && !!adult.status?.mode_enabled;

  const ordered = useMemo(() => {
    const savedOrder = overrides[NAV_ORDER_KEY] as string[] | undefined;
    if (!Array.isArray(savedOrder) || savedOrder.length === 0) return DEFAULT_ITEMS;
    const byTo = new Map(DEFAULT_ITEMS.map((i) => [i.to, i]));
    const result: typeof DEFAULT_ITEMS = [];
    for (const to of savedOrder) {
      const item = byTo.get(to);
      if (item) {
        result.push(item);
        byTo.delete(to);
      }
    }
    // Append any new items that weren't in saved order
    for (const item of byTo.values()) result.push(item);
    return result;
  }, [overrides]);

  const move = (idx: number, dir: -1 | 1) => {
    const next = [...ordered];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    void saveOverride(
      NAV_ORDER_KEY,
      next.map((i) => i.to),
    );
  };

  // Guests keep hearted facts on this device (/favorites); signed-in users see
  // their synced hearts and saved trails on /chains.
  const homeTo = (to: string) => {
    if (to === "/") return adultOn ? "/adult" : "/home";
    if (to === "/chains" && !user) return "/favorites";
    return to;
  };

  return (
    <>
      {/* Wide screens (laptop, desktop, iPad landscape, sideways phone): side rail. */}
      <nav
        data-side-rail
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-40 hidden w-[var(--rail-w)] flex-col border-r border-white/10 bg-black/35 pb-[max(1rem,env(safe-area-inset-bottom))] pl-[env(safe-area-inset-left)] pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-xl wide:flex short:pb-2 short:pt-2"
      >
        <Link
          to={homeTo("/")}
          aria-label="Why? home"
          className="mx-auto mb-6 flex items-center gap-2 rounded-2xl px-2 py-1 short:mb-2 xl:mx-3"
        >
          <span className="short:hidden">
            <WhyLogo size={44} />
          </span>
          <span className="hidden short:inline">
            <WhyLogo size={34} />
          </span>
          <span className="hidden font-display text-2xl font-black text-white xl:inline">
            Why<span className="text-amber-300">?</span>
          </span>
        </Link>
        <div className="flex flex-1 flex-col gap-1.5 px-2 short:gap-0.5 xl:px-3">
          {ordered.map(({ to, label, icon }) => {
            const Icon = ICONS[icon];
            const text = label === "You" && isBoss ? "Boss" : label;
            return (
              <Link
                key={to}
                to={homeTo(to)}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ "data-active": "true" } as never}
                className="group relative flex flex-col items-center gap-1 rounded-2xl px-2 py-2.5 text-[var(--muted-foreground)] transition hover:bg-white/5 hover:text-white data-[active=true]:bg-white/10 data-[active=true]:text-white short:flex-row short:justify-center short:py-1.5 xl:flex-row xl:gap-3 xl:px-4 xl:py-3"
              >
                <span
                  aria-hidden
                  className="absolute inset-y-2 left-0 w-1 rounded-full opacity-0 transition group-data-[active=true]:opacity-100"
                  style={{ background: "var(--gradient-primary)" }}
                />
                <Icon className="h-5 w-5 shrink-0 xl:h-6 xl:w-6" strokeWidth={2.2} />
                <span className="text-[11px] font-bold short:sr-only xl:text-[15px]">
                  <OverrideOr storageKey={`nav.bottom.label.${to}`} fallback={text} />
                </span>
                {label === "You" && isVip && (
                  <Crown
                    aria-label="Why? Plus"
                    className="absolute right-2 top-1.5 h-3.5 w-3.5 text-amber-300 xl:static xl:ml-auto"
                  />
                )}
              </Link>
            );
          })}
        </div>
        <Link
          to="/settings"
          className="mx-2 flex flex-col items-center gap-1 rounded-2xl px-2 py-2 text-[var(--muted-foreground)] hover:bg-white/5 hover:text-white short:flex-row short:justify-center short:py-1 xl:mx-3 xl:flex-row xl:gap-3 xl:px-4"
        >
          <Settings className="h-5 w-5 shrink-0" strokeWidth={2.2} />
          <span className="text-[11px] font-bold short:sr-only xl:text-[15px]">Settings</span>
        </Link>
      </nav>

      {/* Phones and tablets held upright: bottom bar. */}
      <nav
        aria-label="Primary"
        className="safe-x fixed inset-x-0 bottom-0 z-40 pb-[env(safe-area-inset-bottom)] wide:hidden"
      >
        <div className="mx-auto max-w-2xl pb-3">
          <div
            className={`glass-strong flex items-center justify-around rounded-3xl px-2 py-2 shadow-[var(--shadow-card)] ${editMode ? "ring-2 ring-red-400/70" : ""}`}
          >
            {ordered.map(({ to, label, icon }, idx) => {
              const Icon = ICONS[icon];
              const labelKey = `nav.bottom.label.${to}`;
              return (
                <div key={to} className="flex flex-1 flex-col items-center">
                  <Link
                    to={homeTo(to)}
                    activeOptions={{ exact: to === "/" }}
                    activeProps={{ "data-active": "true" } as never}
                    className="group relative flex w-full flex-col items-center justify-center gap-0.5 rounded-2xl px-2 py-1.5 text-[var(--muted-foreground)] transition-all duration-200 hover:-translate-y-0.5 hover:text-white active:scale-90 data-[active=true]:text-foreground"
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
                    <Icon
                      className="h-5 w-5 transition-transform duration-300 group-data-[active=true]:scale-110 group-hover:rotate-[-6deg]"
                      strokeWidth={2.2}
                    />
                    <span className="inline-flex items-center gap-1 text-[10px] font-semibold tracking-wide">
                      {editMode ? (
                        <EditableText storageKey={labelKey}>
                          {label === "You" && isBoss ? "Boss" : label}
                        </EditableText>
                      ) : (
                        <>
                          <OverrideOr
                            storageKey={labelKey}
                            fallback={label === "You" && isBoss ? "Boss" : label}
                          />
                          {label === "You" && isVip && (
                            <span
                              aria-label="Why? Plus"
                              title="Why? Plus member"
                              className="inline-flex items-center rounded-full border border-amber-300/70 bg-gradient-to-br from-amber-300 to-yellow-500 px-1 py-[1px] text-[7px] font-black text-amber-950 shadow-[0_0_6px_rgba(251,191,36,0.55)]"
                            >
                              <Crown className="h-2 w-2" strokeWidth={2.5} />
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </Link>
                  {editMode && (
                    <div className="mt-1 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => move(idx, -1)}
                        disabled={idx === 0}
                        aria-label={`Move ${label} left`}
                        className="rounded-full bg-red-500/80 p-0.5 text-white disabled:opacity-30"
                      >
                        <ArrowLeft className="h-3 w-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => move(idx, 1)}
                        disabled={idx === ordered.length - 1}
                        aria-label={`Move ${label} right`}
                        className="rounded-full bg-red-500/80 p-0.5 text-white disabled:opacity-30"
                      >
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </nav>
    </>
  );
}

function OverrideOr({ storageKey, fallback }: { storageKey: string; fallback: string }) {
  const { getText } = useEditMode();
  return <>{getText(storageKey, fallback)}</>;
}
