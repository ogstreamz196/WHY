import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  defaultSettings,
  getBadges,
  getSettings,
  setSettings as saveSettings,
  type Settings,
} from "@/lib/store";
import { syncFactsFromSheet } from "@/lib/sync.functions";

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
  const [badges, setBadges] = useState(getBadges());
  const [sheetId, setSheetId] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);
  const runSync = useServerFn(syncFactsFromSheet);

  useEffect(() => {
    setLocal(getSettings());
    setBadges(getBadges());
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

        <section className="mb-6 space-y-2 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
          <Toggle
            label="Child Mode"
            hint="Strict child-friendly content filter"
            checked={settings.childMode}
            onChange={(v) => update({ childMode: v })}
          />
          <Toggle
            label="Sound effects"
            hint="Little chimes on Next & reveal"
            checked={settings.sound}
            onChange={(v) => update({ sound: v })}
          />
          <Toggle
            label="Dark mode"
            hint="Coming soon"
            checked={settings.darkMode}
            onChange={(v) => update({ darkMode: v })}
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

        <section className="mb-6 rounded-3xl bg-white/90 p-5 shadow-md ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-slate-900">🏅 Explorer Badges</h2>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {badges.map((b) => (
              <div
                key={b.id}
                className={`rounded-2xl p-3 text-center text-xs ${
                  b.unlocked
                    ? "bg-amber-50 ring-1 ring-amber-200"
                    : "bg-slate-50 text-slate-400 ring-1 ring-slate-200"
                }`}
              >
                <div className={`text-2xl ${b.unlocked ? "" : "opacity-40"}`}>{b.emoji}</div>
                <div className="mt-1 font-semibold">{b.label}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-white/90 p-5 text-sm leading-relaxed text-slate-700 shadow-md ring-1 ring-black/5">
          <h2 className="text-lg font-extrabold text-slate-900">🔒 Privacy</h2>
          <p className="mt-2">
            Why? does not collect personal information. No accounts. No chat between users. No
            comments. Your favorites, streak, and points are stored only on this device.
          </p>
          <p className="mt-2">
            Facts are written by AI and reviewed with automatic child-safety checks before being
            saved.
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
