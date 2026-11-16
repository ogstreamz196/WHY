import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LogOut, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import {
  defaultSettings,
  getSettings,
  setSettings as saveSettings,
  type Settings,
} from "@/lib/store";
import { useCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyProfile } from "@/lib/account.functions";
import { bossAmIBoss } from "@/lib/boss.functions";
import { LinkedAccounts } from "@/components/LinkedAccounts";
import { useIsNativeApp } from "@/lib/platform";
import { CATEGORIES } from "@/lib/categories";
import { isSoundEnabled, setSoundEnabled } from "@/lib/feedback";
import { AdultModeSwitch } from "@/components/AdultModeSwitch";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { saveMyBirthDate } from "@/lib/adult.functions";
import { PLACEHOLDER_DOMAIN } from "@/lib/username-auth.functions";
import { seo } from "@/lib/site";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { WhyLogo } from "@/components/WhyLogo";

export const Route = createFileRoute("/settings")({
  head: () => seo({ title: "Settings | Why?", noindex: true, themeColor: "#7c3aed" }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const router = useRouter();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [settings, setLocal] = useState<Settings>(defaultSettings);
  const { user } = useCurrentUser();
  const isNative = useIsNativeApp();
  const navigate = useNavigate();
  const amIBoss = useServerFn(bossAmIBoss);
  const bossQuery = useQuery({
    queryKey: ["am-i-boss", user?.id],
    queryFn: () => amIBoss(),
    enabled: !!user,
  });
  const isBoss = !!user && !!bossQuery.data?.isBoss;

  useEffect(() => {
    setLocal({ ...getSettings(), sound: isSoundEnabled() });
  }, []);

  const update = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setLocal(next);
    saveSettings(next);
  };

  return (
    <main className="relative min-h-[100dvh] w-full pb-28 wide:pb-8">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" aria-label="Why? home">
            <WhyLogo size={40} />
          </Link>
          {/* Back to wherever you came from (Profile, Store…), else Home. */}
          <button
            type="button"
            onClick={() =>
              router.history.canGoBack() ? router.history.back() : navigate({ to: "/" })
            }
            className="glass rounded-full px-3 py-1 text-sm font-semibold text-white/85"
          >
            ← Back
          </button>
        </header>

        <h1 className="mb-4 text-2xl font-black font-display text-white">⚙️ Settings</h1>

        <section className="mb-6 glass rounded-3xl border border-white/10 p-5">
          <h2 className="mb-3 text-lg font-extrabold text-white">👤 Account</h2>
          {user ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">{accountLabel(user)}</p>
                <Link
                  to="/profile"
                  className="text-xs font-semibold text-violet-300 underline-offset-2 hover:underline"
                >
                  View profile
                </Link>
              </div>
              {confirmSignOut ? (
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  <p className="text-xs font-bold text-white/80">
                    Sign out of {accountLabel(user)}?
                  </p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={async () => {
                        await supabase.auth.signOut();
                        // Drop the signed-out account's cached profile, stats and boards.
                        qc.clear();
                        navigate({ to: "/" });
                      }}
                      className="rounded-full bg-rose-500 px-3 py-1.5 text-xs font-black text-white"
                    >
                      Sign out
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmSignOut(false)}
                      className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white/85"
                    >
                      Stay
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmSignOut(true)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/15 px-3 py-1.5 text-xs font-bold text-rose-200"
                >
                  <LogOut className="h-3.5 w-3.5" /> Sign out
                </button>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-white">Guest explorer</p>
                <p className="text-xs text-white/65">
                  Create a free account to keep your streak & favourites across devices.
                </p>
              </div>
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-violet-600 px-3 py-1.5 text-xs font-bold text-white shadow"
              >
                <Sparkles className="h-3.5 w-3.5" /> Sign up
              </Link>
            </div>
          )}
        </section>

        {user && <BirthdayAndAdultSections userId={user.id} />}

        {/* Linking Google is web-only (Google blocks its sign-in inside apps). */}
        {user && isNative === false && <LinkedAccounts />}
        {user && (
          <section className="mb-6 glass rounded-3xl border border-white/10 p-5">
            <h2 className="text-lg font-extrabold text-white">Delete account</h2>
            <p className="mt-1 text-sm text-white/65">
              Permanently remove your account and everything saved with it.
            </p>
            <Link
              to="/delete-account"
              className="mt-3 inline-block rounded-full bg-rose-600 px-4 py-2 text-sm font-bold text-white"
            >
              Delete my account
            </Link>
          </section>
        )}

        <section className="mb-6 space-y-2 glass rounded-3xl border border-white/10 p-5">
          <h2 className="text-lg font-extrabold text-white">🎛️ Preferences</h2>
          <Toggle
            label="Sound effects"
            hint="Little chimes as you explore"
            checked={settings.sound}
            onChange={(v) => {
              update({ sound: v });
              setSoundEnabled(v);
            }}
          />
          <Toggle
            label="Reduce motion"
            hint="Stops bouncing, wiggling and sliding"
            checked={settings.reduceMotion}
            onChange={(v) => update({ reduceMotion: v })}
          />
          <div className="rounded-2xl px-2 py-2">
            <p className="text-sm font-semibold text-white/90" id="text-size-label">
              Text size
            </p>
            <div
              role="radiogroup"
              aria-labelledby="text-size-label"
              className="mt-2 grid grid-cols-3 gap-1.5"
            >
              {(
                [
                  ["normal", "Normal", "text-sm"],
                  ["large", "Large", "text-base"],
                  ["larger", "Larger", "text-lg"],
                ] as const
              ).map(([key, label, size]) => (
                <button
                  key={key}
                  type="button"
                  role="radio"
                  aria-checked={settings.textSize === key}
                  onClick={() => update({ textSize: key })}
                  className={`rounded-xl px-2 py-2 font-bold ${size} ${
                    settings.textSize === key
                      ? "bg-violet-500 text-white"
                      : "bg-white/10 text-white/80"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {user && <ArenaPreferences />}

        {isBoss && (
          <section className="mb-6 glass rounded-3xl border border-white/10 p-5">
            <h2 className="text-lg font-extrabold text-white">👑 Boss tools</h2>
            <p className="mt-1 text-xs text-white/65">
              Google Drive backup, restores and every dev control live in the Boss Dashboard.
            </p>
            <Link
              to="/boss"
              className="mt-3 inline-block rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white"
            >
              Open Boss Dashboard
            </Link>
          </section>
        )}

        <section className="glass rounded-3xl border border-white/10 p-5 text-sm leading-relaxed text-white/80">
          <h2 className="text-lg font-extrabold text-white">🔒 Privacy</h2>
          <p className="mt-2">
            Guests don't share any personal information — their progress is saved on this device
            only. With an account, your profile and progress sync so you can pick up anywhere. No
            ads, no tracking, no chat between users. Every fact passes automatic child-safety
            checks.
          </p>
          <p className="mt-2">
            <Link to="/privacy" className="font-bold text-violet-300 underline">
              Read the privacy policy
            </Link>
          </p>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}

function Toggle({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl px-2 py-2">
      <span>
        <span className="block text-sm font-semibold text-white/90">{label}</span>
        {hint && <span className="block text-xs text-white/55">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-violet-500" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
            checked ? "left-[calc(100%-1.625rem)]" : "left-0.5"
          }`}
        />
      </button>
    </label>
  );
}

/** Username for username accounts (never their hidden placeholder address), else the email. */
function accountLabel(user: { email?: string | null; user_metadata?: Record<string, unknown> }) {
  const username = user.user_metadata?.username;
  if (typeof username === "string" && username) return username;
  const email = user.email ?? "";
  if (email.endsWith(`@${PLACEHOLDER_DOMAIN}`))
    return email.slice(0, -PLACEHOLDER_DOMAIN.length - 1);
  return email;
}

// Accounts are 13+, so only the teen and adult groups are offered. Older
// saved groups ("under_10", "10_12") show as Teen.
const AGE_OPTIONS: Array<{ key: "teen" | "adult"; label: string }> = [
  { key: "teen", label: "Teen" },
  { key: "adult", label: "Adult" },
];

function ArenaPreferences() {
  const qc = useQueryClient();
  const fetchProfile = useServerFn(getMyProfile);
  const doUpdate = useServerFn(updateMyProfile);
  const p = useQuery({ queryKey: ["profile"], queryFn: () => fetchProfile() });
  const [saving, setSaving] = useState(false);

  const save = async (patch: {
    age_band?: "teen" | "adult";
    favorite_category?: string;
    leaderboard_opt_out?: boolean;
    hide_from_public?: boolean;
  }) => {
    setSaving(true);
    try {
      await doUpdate({ data: patch });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["my-rankings"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const profile = p.data;
  const ageBand =
    profile?.age_band === "under_10" || profile?.age_band === "10_12" ? "teen" : profile?.age_band;

  return (
    <section className="mb-6 space-y-4 glass rounded-3xl border border-white/10 p-5">
      <h2 className="text-lg font-extrabold text-white">🏆 Curiosity Arena</h2>

      <div>
        <p className="text-sm font-semibold text-white/90">Age group</p>
        <p className="text-xs text-white/55">Ranks you against explorers your age.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AGE_OPTIONS.map((a) => {
            const active = ageBand === a.key;
            return (
              <button
                key={a.key}
                type="button"
                disabled={saving}
                onClick={() => save({ age_band: a.key })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 text-white/85 ring-1 ring-white/15"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-white/90">Favourite topic</p>
        <p className="text-xs text-white/55">Shows on your profile and category board.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {CATEGORIES.filter((c) => c.key !== "all").map((c) => {
            const active = profile?.favorite_category === c.key;
            return (
              <button
                key={c.key}
                type="button"
                disabled={saving}
                onClick={() => save({ favorite_category: c.key })}
                className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                  active
                    ? "bg-violet-600 text-white"
                    : "bg-white/10 text-white/85 ring-1 ring-white/15"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-white/10 pt-3">
        <Toggle
          label="Hide me from public leaderboards"
          hint="You still see your own rank, but others won't."
          checked={!!profile?.leaderboard_opt_out}
          onChange={(v) => save({ leaderboard_opt_out: v })}
        />
        <Toggle
          label="Hide profile from public pages"
          hint="Favourites and shared links stop showing your name."
          checked={!!profile?.hide_from_public}
          onChange={(v) => save({ hide_from_public: v })}
        />
      </div>
    </section>
  );
}

const BIRTH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * A one-time, neutral birthday question for accounts that don't have one
 * (for example Google sign-ins), and, on the website for 18+ accounts only,
 * the 18+ mode switch. Nothing about 18+ shows to anyone else.
 */
function BirthdayAndAdultSections({ userId }: { userId: string }) {
  const { status, show, refetch } = useAdultStatus(userId);
  const save = useServerFn(saveMyBirthDate);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const thisYear = new Date().getFullYear();

  if (!status) return null;

  return (
    <>
      {!status.birthdate_known && (
        <section className="mb-6 glass rounded-3xl border border-white/10 p-5">
          <h2 className="text-lg font-extrabold text-white">🎂 Your birthday</h2>
          <p className="mt-1 text-sm text-white/65">
            We ask once so Why? fits your age. It can't be changed later.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              aria-label="Birth month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white [color-scheme:dark]"
            >
              <option value="">Month</option>
              {BIRTH_MONTHS.map((m, i) => (
                <option key={m} value={String(i + 1)}>
                  {m}
                </option>
              ))}
            </select>
            <select
              aria-label="Birth year"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-white [color-scheme:dark]"
            >
              <option value="">Year</option>
              {Array.from({ length: 100 }, (_, i) => String(thisYear - i)).map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            disabled={!month || !year || saving}
            onClick={async () => {
              setSaving(true);
              setMessage(null);
              try {
                const res = await save({ data: { year: Number(year), month: Number(month) } });
                if (!res.ok) setMessage(res.error);
                else await refetch();
              } catch {
                setMessage("Couldn't save that. Please try again.");
              } finally {
                setSaving(false);
              }
            }}
            className="mt-3 rounded-full bg-violet-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
          {message && <p className="mt-2 text-sm text-rose-300">{message}</p>}
        </section>
      )}

      {show && (
        <section className="mb-6 rounded-3xl bg-black/60 p-5 text-white ring-1 ring-red-500/40">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold">🔞 Adults only</h2>
              <p className="mt-1 text-sm text-slate-300">
                18+ mode: crude, gross and sweary facts, and OG, a foul-mouthed bot. Website only.
              </p>
            </div>
            <AdultModeSwitch on={status.mode_enabled} userId={userId} />
          </div>
        </section>
      )}
    </>
  );
}
