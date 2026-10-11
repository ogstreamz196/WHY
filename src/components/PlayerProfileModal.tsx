import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import {
  Award,
  Brain,
  Calendar,
  Crown,
  Flame,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import { VipBadge } from "@/components/VipBadge";
import { emojiFor } from "@/lib/categories";
import { avatarEmojiFor } from "@/lib/store";
import { getPlayerProfilePublic, type PlayerProfilePublic } from "@/lib/player-profile.functions";

type Props = {
  userId: string | null;
  rank?: number | null;
  totalUsers?: number | null;
  boardLabel?: string;
  isMe?: boolean;
  onClose: () => void;
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

function since(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function PlayerProfileModal({ userId, rank, totalUsers, boardLabel, isMe, onClose }: Props) {
  const fetchProfile = useServerFn(getPlayerProfilePublic);
  const [data, setData] = useState<PlayerProfilePublic | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    setLoading(true);
    setData(null);
    setError(null);
    fetchProfile({ data: { userId } })
      .then((p) => {
        if (!alive) return;
        if (!p) setError("This explorer has kept their profile private.");
        else setData(p);
      })
      .catch(() => alive && setError("Couldn't load this player right now. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [userId, fetchProfile, attempt]);

  useEffect(() => {
    if (!userId) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [userId, onClose]);

  const open = !!userId;
  const name = data?.display_name || data?.username || "Explorer";
  const initial = name.slice(0, 1).toUpperCase();
  const podium = rank && rank <= 3;
  const rankTone =
    rank === 1
      ? "from-amber-400 via-yellow-300 to-amber-500 text-amber-950"
      : rank === 2
        ? "from-slate-200 via-white to-slate-300 text-slate-900"
        : rank === 3
          ? "from-orange-400 via-orange-300 to-orange-500 text-orange-950"
          : "from-fuchsia-500 to-violet-500 text-white";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="player-modal"
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={`${name} profile`}
        >
          <motion.div
            initial={{ y: 60, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 300, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong relative w-full max-w-md overflow-hidden rounded-t-3xl border border-white/15 shadow-[0_30px_80px_-20px_rgba(0,0,0,0.6)] sm:rounded-3xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close player profile"
              className="absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/40 text-white/80 hover:bg-black/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Rank banner */}
            <div
              className={`relative overflow-hidden bg-gradient-to-br ${rankTone} px-5 pb-6 pt-8`}
            >
              {podium && (
                <motion.div
                  className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2"
                  animate={{ y: [0, -4, 0], rotate: [-6, 6, -6] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  aria-hidden
                >
                  <Crown className="h-10 w-10 fill-current drop-shadow-[0_0_18px_rgba(0,0,0,0.35)]" />
                </motion.div>
              )}
              <div className="flex items-center gap-4">
                <motion.div
                  initial={{ scale: 0.7, rotate: -8 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white/70 bg-neutral-950 shadow-xl"
                >
                  {data?.avatar_id ? (
                    <span className="text-4xl" aria-hidden>
                      {avatarEmojiFor(data.avatar_id)}
                    </span>
                  ) : (
                    <span className="text-3xl font-black text-white">{initial}</span>
                  )}
                  {isMe && (
                    <span className="absolute -bottom-2 -right-2 rounded-full border border-white bg-fuchsia-500 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white shadow-md">
                      You
                    </span>
                  )}
                </motion.div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-black uppercase tracking-widest opacity-80">
                    {boardLabel ? `${boardLabel} · Rank` : "Rank"}
                  </p>
                  <p className="font-display text-3xl font-black leading-none">
                    {rank ? `#${rank.toLocaleString()}` : "—"}
                    {totalUsers ? (
                      <span className="ml-2 align-middle text-xs font-bold opacity-70">
                        of {totalUsers.toLocaleString()}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-1 flex items-center gap-1 truncate text-base font-black">
                    <span className="truncate">{name}</span>
                    {data?.is_vip && <VipBadge size="xs" className="ml-1" />}
                  </p>
                </div>
              </div>
            </div>

            {/* Body */}
            <div className="max-h-[70vh] overflow-y-auto px-5 pb-6 pt-4">
              {loading ? (
                <div className="space-y-3" aria-busy="true" aria-live="polite" role="status">
                  <span className="sr-only">Loading player profile…</span>
                  <div className="grid grid-cols-2 gap-2.5">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-[76px] animate-pulse rounded-2xl border border-white/10 bg-white/[0.04]"
                      />
                    ))}
                  </div>
                  <div className="h-24 animate-pulse rounded-2xl border border-white/10 bg-white/[0.03]" />
                </div>
              ) : error ? (
                <div
                  role="alert"
                  className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 text-center"
                >
                  <p className="text-2xl" aria-hidden>
                    😕
                  </p>
                  <p className="mt-2 text-sm text-white/80">{error}</p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setAttempt((n) => n + 1)}
                      className="min-h-11 rounded-full px-4 py-2 text-xs font-black text-white shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fuchsia-300/70"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      Try again
                    </button>
                    <button
                      type="button"
                      onClick={onClose}
                      className="min-h-11 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs font-black text-white/80 hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : data ? (
                <>
                  {data.bio && (
                    <p className="mb-3 rounded-2xl border border-white/10 bg-white/[0.04] p-3 text-sm italic text-white/80">
                      &ldquo;{data.bio}&rdquo;
                    </p>
                  )}

                  <div className="grid grid-cols-2 gap-2.5">
                    <StatCard
                      icon={<Trophy className="h-4 w-4" />}
                      label="Curiosity Score"
                      value={data.total_score.toLocaleString()}
                      tone="from-fuchsia-500/20 to-violet-500/10 text-fuchsia-100 border-fuchsia-400/30"
                    />
                    <StatCard
                      icon={<Flame className="h-4 w-4" />}
                      label="Current streak"
                      value={`${data.current_streak}d`}
                      sub={`Best ${data.longest_streak}d`}
                      tone="from-orange-500/20 to-rose-500/10 text-orange-100 border-orange-400/30"
                    />
                    <StatCard
                      icon={<Sparkles className="h-4 w-4" />}
                      label="Facts seen"
                      value={data.facts_seen.toLocaleString()}
                      tone="from-sky-500/20 to-cyan-500/10 text-sky-100 border-sky-400/30"
                    />
                    <StatCard
                      icon={<Target className="h-4 w-4" />}
                      label="Quiz accuracy"
                      value={`${data.quiz_accuracy}%`}
                      sub={`${data.quiz_correct_answered}/${data.quiz_questions_answered}`}
                      tone="from-emerald-500/20 to-teal-500/10 text-emerald-100 border-emerald-400/30"
                    />
                    <StatCard
                      icon={<Brain className="h-4 w-4" />}
                      label="Best quiz"
                      value={data.quiz_best_score.toLocaleString()}
                      tone="from-indigo-500/20 to-blue-500/10 text-indigo-100 border-indigo-400/30"
                    />
                    <StatCard
                      icon={<Zap className="h-4 w-4" />}
                      label="Best quiz streak"
                      value={`${data.quiz_best_streak}`}
                      tone="from-amber-500/20 to-yellow-500/10 text-amber-100 border-amber-400/30"
                    />
                  </div>

                  <dl className="mt-3 space-y-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-3 text-xs text-white/70">
                    {data.favorite_category && (
                      <Row
                        icon={<Award className="h-3.5 w-3.5" />}
                        label="Favorite category"
                        value={
                          <>
                            <span className="mr-1">{emojiFor(data.favorite_category)}</span>
                            <span className="capitalize">
                              {data.favorite_category.replace(/_/g, " ")}
                            </span>
                          </>
                        }
                      />
                    )}
                    {data.age_band && (
                      <Row
                        icon={<Users />}
                        label="Age band"
                        value={
                          <span className="capitalize">{data.age_band.replace(/_/g, " ")}</span>
                        }
                      />
                    )}
                    <Row
                      icon={<Calendar className="h-3.5 w-3.5" />}
                      label="Explorer since"
                      value={since(data.joined_at)}
                    />
                    {rank && totalUsers ? (
                      <Row
                        icon={<Trophy className="h-3.5 w-3.5" />}
                        label="Position"
                        value={`${ordinal(rank)} of ${totalUsers.toLocaleString()}`}
                      />
                    ) : null}
                  </dl>
                </>
              ) : null}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  tone: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 320, damping: 22 }}
      className={`rounded-2xl border bg-gradient-to-br p-3 ${tone}`}
    >
      <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest opacity-90">
        {icon}
        {label}
      </div>
      <p className="mt-1 font-display text-xl font-black text-white">{value}</p>
      {sub && <p className="text-[10px] font-bold opacity-70">{sub}</p>}
    </motion.div>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="inline-flex items-center gap-1.5 font-black uppercase tracking-widest text-white/50">
        <span className="opacity-70">{icon}</span>
        {label}
      </span>
      <span className="font-bold text-white/90">{value}</span>
    </div>
  );
}

function Users(props: { className?: string }) {
  // small local svg fallback so we don't add another import
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={props.className ?? "h-3.5 w-3.5"}
      aria-hidden
    >
      <path d="M17 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M9 21v-2a4 4 0 0 1 3-3.87" />
      <circle cx="9" cy="7" r="4" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
