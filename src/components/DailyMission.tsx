import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Loader2, Check, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  getTodayMission,
  markMissionTask,
  claimMissionBonus,
  type DailyMissionDTO,
  type MissionTask,
} from "@/lib/missions.functions";
import { useCurrentUser } from "@/lib/auth";
import { emojiFor } from "@/lib/categories";

const TASKS: { key: MissionTask; label: string; hint: string; icon: string }[] = [
  { key: "mystery",  label: "Today's mystery",   hint: "Reveal today's featured why", icon: "🔮" },
  { key: "surprise", label: "One surprise fact", hint: "Tap Next for a fresh why",    icon: "✨" },
  { key: "chain",    label: "Follow a chain",    hint: "Ask “But why?” 3 times",      icon: "🔗" },
  { key: "category", label: "Explore a theme",   hint: "Discover in today's category",icon: "🎯" },
];

type Props = {
  onOpenCategory: (key: string) => void;
  onCelebrate: (points: number) => void;
  registerMarker?: (fn: (task: MissionTask) => void) => void;
};

export function DailyMission({ onOpenCategory, onCelebrate, registerMarker }: Props) {
  const { user } = useCurrentUser();
  const fetchMission = useServerFn(getTodayMission);
  const markTask = useServerFn(markMissionTask);
  const claim = useServerFn(claimMissionBonus);

  const [mission, setMission] = useState<DailyMissionDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [expanded, setExpanded] = useState(true);

  useEffect(() => {
    if (!user) { setLoading(false); return; }
    let cancelled = false;
    fetchMission()
      .then((m) => { if (!cancelled) { setMission(m); setLoading(false); } })
      .catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user, fetchMission]);

  useEffect(() => {
    if (!registerMarker) return;
    registerMarker(async (task) => {
      if (!user) return;
      // Optimistic
      setMission((prev) => {
        if (!prev) return prev;
        const next = { ...prev };
        if (task === "mystery")  next.mystery_done = true;
        if (task === "surprise") next.surprise_done = true;
        if (task === "chain")    next.chain_done = true;
        if (task === "category") next.category_done = true;
        next.completed = next.mystery_done && next.surprise_done && next.chain_done && next.category_done;
        return next;
      });
      try {
        const res = await markTask({ data: { task } });
        setMission(res);
      } catch (e) { console.warn("mission mark failed", e); }
    });
  }, [registerMarker, markTask, user]);

  if (!user || loading || !mission) return null;

  const done = [mission.mystery_done, mission.surprise_done, mission.chain_done, mission.category_done];
  const doneCount = done.filter(Boolean).length;
  const pct = Math.round((doneCount / 4) * 100);

  async function handleClaim() {
    if (claiming || !mission || mission.bonus_awarded || !mission.completed) return;
    setClaiming(true);
    try {
      const res = await claim();
      if (res.awarded) {
        onCelebrate(res.points);
        setMission({ ...mission, bonus_awarded: true });
        toast.success(`+${res.points} XP mission bonus!`, { description: "Come back tomorrow for a new mission." });
      }
    } catch (e) { console.warn(e); }
    finally { setClaiming(false); }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="mb-3 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-indigo-500/15 via-violet-500/10 to-fuchsia-500/15 p-4 shadow-[0_0_24px_rgba(139,92,246,0.15)] sm:p-5 md:p-6 lg:p-7"
    >
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 text-left sm:gap-4"
      >
        <ProgressRing pct={pct} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 sm:h-4 sm:w-4" />
            <h3 className="font-display text-sm font-black uppercase tracking-wider text-white sm:text-base md:text-lg">
              Today's mission
            </h3>
          </div>
          <p className="mt-0.5 text-xs text-white/60 sm:text-sm md:text-[0.95rem]">
            {mission.completed
              ? mission.bonus_awarded ? "All complete — see you tomorrow ✨" : "All 4 done — claim your bonus!"
              : `${doneCount} of 4 complete · Category: ${emojiFor(mission.category_key)} ${mission.category_key}`}
          </p>
        </div>
        <motion.span
          animate={{ rotate: expanded ? 180 : 0 }}
          className="text-white/40"
        >⌄</motion.span>
      </button>


      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="tasks"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-3 grid grid-cols-1 gap-2 sm:mt-4 sm:grid-cols-2 sm:gap-3 md:gap-4"
          >
            {TASKS.map((t, i) => {
              const isDone = done[i];
              const isCategory = t.key === "category";
              return (
                <div
                  key={t.key}
                  className={`flex items-center gap-3 rounded-2xl border px-3 py-2.5 transition sm:gap-4 sm:px-4 sm:py-3 md:px-5 md:py-4 ${
                    isDone
                      ? "border-emerald-400/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  <span className="shrink-0 text-lg sm:text-xl md:text-2xl">{t.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm font-bold leading-snug sm:text-[0.95rem] md:text-base ${isDone ? "text-emerald-200 line-through" : "text-white"}`}>
                      {t.label}
                      {isCategory && (
                        <span className="ml-1 font-normal text-white/50">
                          — {emojiFor(mission.category_key)} {mission.category_key}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] leading-snug text-white/50 sm:text-xs md:text-sm">{t.hint}</div>
                  </div>
                  {isDone ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-emerald-300 sm:h-7 sm:w-7"
                    >
                      <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    </motion.span>
                  ) : isCategory ? (
                    <button
                      type="button"
                      onClick={() => onOpenCategory(mission.category_key)}
                      className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-white/80 transition hover:bg-white/20 sm:px-3 sm:py-1.5 sm:text-xs"
                    >
                      Go
                    </button>
                  ) : (
                    <span className="shrink-0 text-white/20"><Lock className="h-3.5 w-3.5 sm:h-4 sm:w-4" /></span>
                  )}
                </div>
              );
            })}


            {mission.completed && !mission.bonus_awarded && (
              <motion.button
                type="button"
                onClick={handleClaim}
                disabled={claiming}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60 sm:col-span-2"
                style={{ background: "var(--gradient-primary)" }}
              >
                {claiming ? <Loader2 className="h-4 w-4 animate-spin" /> : "🎁 Claim +50 XP bonus"}
              </motion.button>
            )}

          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function ProgressRing({ pct }: { pct: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="3.5" />
      <motion.circle
        cx="22" cy="22" r={r}
        fill="none"
        stroke="url(#missionGrad)"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: c - dash }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
      <defs>
        <linearGradient id="missionGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#a78bfa" />
          <stop offset="100%" stopColor="#f0abfc" />
        </linearGradient>
      </defs>
    </svg>
  );
}
