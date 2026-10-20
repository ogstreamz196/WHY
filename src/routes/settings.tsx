import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
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

export const Route = createFileRoute("/settings")({
  head: () => seo({ title: "Settings | Why?", noindex: true, themeColor: "#7c3aed" }),
  component: SettingsPage,
});

function SettingsPage() {
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
    <main className="relative min-h-[100dvh] w-full">
      <div
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background: "linear-gradient(180deg, #fef3c7 0%, #ede9fe 100%)",
        }}
      />
      <div className="mx-auto max-w-2xl px-4 pb-10 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tight">
            <span className="text-violet-700">Why</span>
            <span className="text-amber-500">?</span>
          </Link>
          <Link
            to="/"
            className="rounded-full bg-white/80 px-3 py-1 text-sm font-semibold text-slate-700 shadow-sm"
          >
            ← Back
          </Link>
        </header>

        <h1 className="mb-4 text-2xl font-extrabold text-slate-900">⚙️ Settings</h1>

        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">👤 Account</h2>
          {user ? (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">{accountLabel(user)}</p>
                <Link
                  to="/profile"
                  className="text-xs font-semibold text-violet-700 underline-offset-2 hover:underline"
                >
                  View profile
                </Link>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await supabase.auth.signOut();
                  navigate({ to: "/" });
                }}
                className="inline-flex items-center gap-1.5 rounded-full bg-rose-100 px-3 py-1.5 text-xs font-bold text-rose-700"
              >
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-900">Guest explorer</p>
                <p className="text-xs text-slate-600">
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
          <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
            <h2 className="text-lg font-extrabold text-slate-900">Delete account</h2>
            <p className="mt-1 text-sm text-slate-600">
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

        <section className="mb-6 space-y-2 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-slate-900">🎛️ Preferences</h2>
          <Toggle
            label="Sound effects"
            hint="Little chimes on Next & reveal"
            checked={settings.sound}
            onChange={(v) => {
              update({ sound: v });
              setSoundEnabled(v);
            }}
          />
        </section>

        {user && <ArenaPreferences />}

        {isBoss && (
          <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
            <h2 className="text-lg font-extrabold text-slate-900">👑 Boss tools</h2>
            <p className="mt-1 text-xs text-slate-600">
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

        <section className="rounded-3xl bg-white/90 p-5 text-sm leading-relaxed text-slate-700 shadow-md ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-slate-900">🔒 Privacy</h2>
          <p className="mt-2">
            Guests don't share any personal information — their progress is saved on this device
            only. With an account, your profile and progress sync so you can pick up anywhere. No
            ads, no tracking, no chat between users. Every fact passes automatic child-safety
            checks.
          </p>
          <p className="mt-2">
            <Link to="/privacy" className="font-bold text-violet-700 underline">
              Read the privacy policy
            </Link>
          </p>
        </section>
      </div>
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
        <span className="block text-sm font-semibold text-slate-800">{label}</span>
        {hint && <span className="block text-xs text-slate-500">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-violet-600" : "bg-slate-300"
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
    <section className="mb-6 space-y-4 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
      <h2 className="text-lg font-extrabold text-slate-900">🏆 Curiosity Arena</h2>

      <div>
        <p className="text-sm font-semibold text-slate-800">Age group</p>
        <p className="text-xs text-slate-500">Ranks you against explorers your age.</p>
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
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-sm font-semibold text-slate-800">Favourite topic</p>
        <p className="text-xs text-slate-500">Shows on your profile and category board.</p>
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
                    : "bg-white text-slate-700 ring-1 ring-slate-200"
                }`}
              >
                {c.emoji} {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-slate-200 pt-3">
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
        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-slate-900">🎂 Your birthday</h2>
          <p className="mt-1 text-sm text-slate-600">
            We ask once so Why? fits your age. It can't be changed later.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <select
              aria-label="Birth month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
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
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
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
          {message && <p className="mt-2 text-sm text-rose-600">{message}</p>}
        </section>
      )}

      {show && (
        <section className="mb-6 rounded-3xl bg-slate-950 p-5 text-white shadow-md ring-1 ring-red-500/40">
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
