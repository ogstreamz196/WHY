import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, LogOut, Sparkles, Trophy, Zap, Pencil, Loader2, Check, Clock, ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyProfile,
  updateMyProfile,
  getMyStats,
  listAchievements,
  type Achievement,
} from "@/lib/account.functions";
import {
  getDiscoveryTimeline,
  getCategoryInterests,
  listMyChains,
} from "@/lib/chains.functions";
import { CoinIcon } from "@/components/CoinIcon";
import { BottomNav } from "@/components/BottomNav";
import { useCurrentUser } from "@/lib/auth";
import { STORE_CATALOG } from "@/lib/store";
import { emojiFor } from "@/lib/categories";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [{ title: "Your profile — Why?" }, { name: "theme-color", content: "#100c1f" }],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchProfile = useServerFn(getMyProfile);
  const fetchStats = useServerFn(getMyStats);
  const fetchAchievements = useServerFn(listAchievements);
  const doUpdate = useServerFn(updateMyProfile);
  const fetchTimeline = useServerFn(getDiscoveryTimeline);
  const fetchInterests = useServerFn(getCategoryInterests);
  const fetchChains = useServerFn(listMyChains);

  const profile = useQuery({
    queryKey: ["profile"],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });
  const stats = useQuery({
    queryKey: ["stats"],
    queryFn: () => fetchStats(),
    enabled: !!user,
  });
  const achievements = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchAchievements(),
    enabled: !!user,
  });
  const timeline = useQuery({
    queryKey: ["timeline"],
    queryFn: () => fetchTimeline({ data: { limit: 20 } }),
    enabled: !!user,
  });
  const interests = useQuery({
    queryKey: ["interests"],
    queryFn: () => fetchInterests(),
    enabled: !!user,
  });
  const chains = useQuery({
    queryKey: ["chains", "preview"],
    queryFn: () => fetchChains(),
    enabled: !!user,
  });

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/profile" } });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (profile.data) {
      setName(profile.data.display_name ?? "");
      setBio(profile.data.bio ?? "");
    }
  }, [profile.data]);

  if (loading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }

  const s = stats.data ?? { total_points: 0, current_streak: 0, longest_streak: 0, facts_seen: 0 };
  const level = Math.max(1, Math.floor(s.total_points / 100) + 1);
  const levelXP = s.total_points % 100;
  const avatar = STORE_CATALOG.find((i) => i.id === profile.data?.avatar_id) ?? STORE_CATALOG[0];
  const unlockedCount = (achievements.data ?? []).filter((a) => a.unlocked_at).length;

  async function save() {
    setSaving(true);
    try {
      await doUpdate({ data: { display_name: name.trim() || undefined, bio: bio.trim() || undefined } });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong relative overflow-hidden rounded-4xl border border-white/10 p-6"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full opacity-40 blur-3xl"
            style={{ background: "var(--gradient-primary)" }}
          />
          <div className="flex items-center gap-4">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <span>{avatar?.emoji ?? "🌱"}</span>
            </div>
            <div className="flex-1">
              {editing ? (
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  maxLength={60}
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-2 py-1 font-display text-xl font-black text-white outline-none"
                />
              ) : (
                <h1 className="font-display text-2xl font-black text-white">
                  {profile.data?.display_name ?? "Curious explorer"}
                </h1>
              )}
              <p className="mt-0.5 text-xs text-white/50">{user.email}</p>
            </div>
            <button
              type="button"
              onClick={() => (editing ? save() : setEditing(true))}
              disabled={saving}
              className="rounded-full border border-white/10 bg-white/5 p-2 text-white/70"
              aria-label={editing ? "Save" : "Edit profile"}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editing ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            </button>
          </div>

          {editing && (
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell the world what makes you curious…"
              maxLength={280}
              rows={2}
              className="mt-3 w-full rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm text-white outline-none"
            />
          )}
          {!editing && profile.data?.bio && (
            <p className="mt-3 text-sm italic text-white/70">"{profile.data.bio}"</p>
          )}

          <div className="mt-5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-widest text-white/50">
              <span>Level {level}</span>
              <span>{levelXP}/100</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "var(--gradient-primary)" }}
                animate={{ width: `${levelXP}%` }}
              />
            </div>
          </div>
        </motion.div>

        {/* Stats grid */}
        <section className="mt-4 grid grid-cols-2 gap-3">
          <StatTile icon={<CoinIcon size={20} />} label="Y-Coins" value={s.total_points} />
          <StatTile icon={<Flame className="h-5 w-5 text-orange-400" />} label="Streak" value={`${s.current_streak} 🔥`} />
          <StatTile icon={<Zap className="h-5 w-5 text-yellow-300" />} label="Longest streak" value={s.longest_streak} />
          <StatTile icon={<Sparkles className="h-5 w-5 text-fuchsia-300" />} label="Facts seen" value={s.facts_seen} />
        </section>

        {/* Achievements */}
        <section className="mt-6">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-black text-white">
              <Trophy className="h-5 w-5 text-amber-300" /> Achievements
            </h2>
            <span className="text-xs font-bold text-white/50">
              {unlockedCount}/{achievements.data?.length ?? 0}
            </span>
          </header>
          <div className="grid grid-cols-3 gap-3">
            {(achievements.data ?? []).map((a) => (
              <AchievementTile key={a.id} a={a} />
            ))}
          </div>
        </section>

        {/* Category interests */}
        {interests.data && interests.data.length > 0 && (
          <section className="mt-6">
            <h2 className="mb-3 font-display text-lg font-black text-white">Your curiosity map</h2>
            <div className="flex flex-wrap gap-2">
              {interests.data.slice(0, 8).map((it) => (
                <div key={it.category} className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/85">
                  <span>{emojiFor(it.category)}</span>
                  <span className="capitalize">{it.category}</span>
                  <span className="text-white/50">·{it.weight}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Saved chains */}
        <section className="mt-6">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-white">Saved chains</h2>
            <Link to="/chains" className="text-xs font-bold text-fuchsia-200">
              View all →
            </Link>
          </header>
          {chains.data && chains.data.length > 0 ? (
            <div className="space-y-2">
              {chains.data.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  to="/chain/$id"
                  params={{ id: c.id }}
                  className="glass flex items-center gap-3 rounded-2xl border border-white/10 px-3 py-2.5"
                >
                  <Sparkles className="h-4 w-4 text-fuchsia-300" />
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm font-bold text-white">{c.title ?? "Untitled chain"}</div>
                    <div className="text-[10px] text-white/50">{c.step_count} steps</div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-white/40" />
                </Link>
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
              Save your first Why chain from the home screen.
            </p>
          )}
        </section>

        {/* Discovery timeline */}
        <section className="mt-6">
          <h2 className="mb-3 inline-flex items-center gap-2 font-display text-lg font-black text-white">
            <Clock className="h-4 w-4 text-white/70" /> Recent discoveries
          </h2>
          {timeline.data && timeline.data.length > 0 ? (
            <ol className="space-y-2">
              {timeline.data.map((entry, i) => (
                <motion.li
                  key={`${entry.fact.id}-${i}`}
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.02 }}
                  className="flex items-start gap-2 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-2"
                >
                  <span className="mt-0.5 text-base">{emojiFor(entry.fact.category)}</span>
                  <div className="flex-1 min-w-0">
                    <div className="truncate text-sm text-white/90">{entry.fact.question}</div>
                    <div className="text-[10px] text-white/40">
                      {new Date(entry.seen_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                    </div>
                  </div>
                </motion.li>
              ))}
            </ol>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-xs text-white/60">
              Every fact you reveal shows up here.
            </p>
          )}
        </section>

        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            to="/settings"
            className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2.5 text-center text-sm font-bold text-white/90"
          >
            Settings
          </Link>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/" });
            }}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm font-bold text-rose-200"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </div>
      <BottomNav />
    </main>
  );
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number | string }) {
  return (
    <div className="glass rounded-3xl border border-white/10 p-4">
      <div className="flex items-center gap-2">{icon}<span className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</span></div>
      <div className="mt-1 font-display text-2xl font-black text-white">{value}</div>
    </div>
  );
}

function AchievementTile({ a }: { a: Achievement }) {
  const unlocked = !!a.unlocked_at;
  return (
    <motion.div
      whileHover={{ scale: 1.03 }}
      className={`relative rounded-2xl border p-3 text-center text-xs ${
        unlocked
          ? "border-amber-300/30 bg-amber-400/10 text-white"
          : "border-white/10 bg-white/[0.03] text-white/40"
      }`}
    >
      <div className={`text-3xl ${unlocked ? "" : "grayscale opacity-40"}`}>{a.emoji}</div>
      <div className="mt-1 font-black leading-tight">{a.name}</div>
      <div className="mt-1 text-[10px] font-medium text-white/50 leading-tight">{a.description}</div>
    </motion.div>
  );
}
