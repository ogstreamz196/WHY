import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Flame } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { AvatarFigure } from "@/components/AvatarFigure";
import { CoinIcon } from "@/components/CoinIcon";
import { RewardReveal, type RevealPrize } from "@/components/RewardReveal";
import { VipBadge } from "@/components/VipBadge";
import { useDressUp, useMyAvatar, useWeeklyDrop } from "@/hooks/useMyAvatar";

type Props = {
  userId: string | null;
  name: string;
  level: number;
  streak: number;
  points: number;
  isPlus?: boolean;
};

/**
 * Home-page player card: the dressed-up avatar, name, level, streak and coins,
 * with quick links to dress up and to the profile, and this week's free drop.
 */
export function HomePlayerCard({ userId, name, level, streak, points, isPlus }: Props) {
  const avatar = useMyAvatar(userId);
  const drop = useWeeklyDrop(userId);
  const dressUp = useDressUp(userId);
  const [prize, setPrize] = useState<RevealPrize | null>(null);
  const [claiming, setClaiming] = useState(false);

  async function claimDrop() {
    if (!drop || claiming) return;
    setClaiming(true);
    try {
      const ok = await drop.claim();
      if (ok) setPrize({ kind: "item", item: drop.item });
      else toast("You already have this week's drop!");
    } catch (e) {
      console.error(e);
      toast.error("Couldn't claim the drop. Please try again.");
    } finally {
      setClaiming(false);
    }
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong relative mb-3 overflow-hidden rounded-3xl border border-white/10 p-4"
      aria-label="Your explorer"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute -left-10 -top-10 h-40 w-40 rounded-full opacity-40 blur-3xl"
        style={{ background: "var(--gradient-primary)" }}
      />
      <div className="relative flex items-center gap-4">
        <Link
          to={userId ? "/profile" : "/store"}
          aria-label={userId ? "Open your profile" : "Dress up your avatar"}
          className="relative flex h-24 w-24 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/5"
        >
          <AvatarFigure avatarId={avatar.avatarId} outfit={avatar.outfit} className="text-5xl" />
        </Link>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate font-display text-lg font-black text-white">
            <span className="truncate">{name}</span>
            {isPlus && <VipBadge size="xs" />}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] font-black text-white/80">
            <span className="rounded-full bg-white/10 px-2 py-0.5">Lvl {level}</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
              <Flame className="h-3 w-3 text-orange-300" aria-hidden />
              {streak}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5">
              <CoinIcon size={12} aria-hidden />
              {points}
            </span>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Link
              to="/store"
              className="rounded-full px-3 py-1.5 text-xs font-black text-white shadow"
              style={{ background: "var(--gradient-primary)" }}
            >
              🎨 Dress up
            </Link>
            {userId && (
              <Link
                to="/profile"
                className="rounded-full bg-white/10 px-3 py-1.5 text-xs font-black text-white"
              >
                Profile
              </Link>
            )}
          </div>
        </div>
      </div>

      {drop && !drop.claimed && (
        <motion.button
          type="button"
          onClick={claimDrop}
          disabled={claiming}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mt-3 flex w-full items-center gap-3 overflow-hidden rounded-2xl border border-amber-300/40 bg-gradient-to-r from-amber-400/20 via-pink-500/15 to-violet-500/20 px-3 py-2.5 text-left disabled:opacity-60"
        >
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent"
            animate={{ x: ["-120%", "320%"] }}
            transition={{ duration: 2.4, repeat: Infinity, repeatDelay: 1.5 }}
          />
          <motion.span
            aria-hidden
            className="text-3xl"
            animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.6 }}
          >
            🎁
          </motion.span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] font-black uppercase tracking-widest text-amber-200">
              Free special drop this week
            </span>
            <span className="block truncate text-sm font-black text-white">
              Tap to open a mystery item for your avatar
            </span>
          </span>
          <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-black text-white">
            {claiming ? "…" : "Open"}
          </span>
        </motion.button>
      )}

      <RewardReveal
        prize={prize}
        title="This week's special drop"
        avatar={avatar}
        onWear={async (item) => {
          try {
            await dressUp(item);
            toast.success(`${item.emoji} ${item.name} on!`);
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Couldn't put that on");
          }
        }}
        onClose={() => setPrize(null)}
      />
    </motion.section>
  );
}
