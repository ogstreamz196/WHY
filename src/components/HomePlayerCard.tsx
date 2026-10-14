import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { AvatarFigure } from "@/components/AvatarFigure";
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

  // Slim showcase: just the dressed-up avatar and a friendly hello, so the
  // fact below is visible straight away. Stats live in the header/profile.
  void level;
  void streak;
  void points;
  return (
    <motion.section
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative mb-4 flex items-center gap-4"
      aria-label="Your explorer"
    >
      <Link
        to="/store"
        aria-label="Dress up your avatar"
        className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-3xl border border-white/15 bg-white/5"
      >
        <AvatarFigure avatarId={avatar.avatarId} outfit={avatar.outfit} className="text-7xl" />
        <span
          aria-hidden
          className="absolute -bottom-1.5 -right-1.5 rounded-full bg-white/90 px-1.5 py-0.5 text-xs shadow"
        >
          🎨
        </span>
      </Link>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-white/60">Ready to explore?</p>
        <p className="flex items-center gap-2 truncate font-display text-2xl wide:whitespace-normal wide:text-xl font-black text-white">
          <span className="truncate wide:line-clamp-2 wide:whitespace-normal wide:break-words">
            {name}
          </span>
          {isPlus && <VipBadge size="xs" />}
        </p>
      </div>
      {drop && !drop.claimed && (
        <motion.button
          type="button"
          onClick={claimDrop}
          disabled={claiming}
          aria-label="Open this week's free special drop"
          animate={{ rotate: [0, -10, 10, -6, 6, 0] }}
          transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.5 }}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-amber-300/40 bg-amber-400/20 text-3xl disabled:opacity-60"
        >
          🎁
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
