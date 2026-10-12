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

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Why?" },
      { name: "description", content: "Preferences and privacy for the Why? app." },
      { name: "theme-color", content: "#7c3aed" },
    ],
  }),
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
                <p className="text-sm font-bold text-slate-900">{user.email}</p>
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
          <div className="pt-2">
            <p className="text-sm font-semibold text-slate-800">Reading level</p>
            <div className="mt-2 flex gap-2">
              {(["easy", "standard"] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => update({ readingLevel: lvl })}
                  className={`flex-1 rounded-2xl px-3 py-2 text-sm font-bold ${
                    settings.readingLevel === lvl
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-700 ring-1 ring-slate-200"
                  }`}
                >
                  {lvl === "easy" ? "Easy (6–9)" : "Standard (8–12)"}
                </button>
              ))}
            </div>
          </div>
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

const AGE_OPTIONS: Array<{ key: "under_10" | "10_12" | "teen" | "adult"; label: string }> = [
  { key: "under_10", label: "Under 10" },
  { key: "10_12", label: "10–12" },
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
    age_band?: "under_10" | "10_12" | "teen" | "adult";
    favorite_category?: string;
    leaderboard_opt_out?: boolean;
    hide_from_public?: boolean;
  }) => {
    setSaving(true);
    try {
      await doUpdate({ data: patch });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["my-rankings"] });
    } finally {
      setSaving(false);
    }
  };

  const profile = p.data;

  return (
    <section className="mb-6 space-y-4 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
      <h2 className="text-lg font-extrabold text-slate-900">🏆 Curiosity Arena</h2>

      <div>
        <p className="text-sm font-semibold text-slate-800">Age group</p>
        <p className="text-xs text-slate-500">Ranks you against explorers your age.</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {AGE_OPTIONS.map((a) => {
            const active = profile?.age_band === a.key;
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
