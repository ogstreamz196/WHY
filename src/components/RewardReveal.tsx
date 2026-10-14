import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CoinIcon } from "@/components/CoinIcon";
import { ConfettiBurst } from "@/components/ConfettiBurst";
import { AvatarFigure } from "@/components/AvatarFigure";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { RARITY_STYLE, rarityOf, type Outfit } from "@/lib/avatarItems";
import { feedback } from "@/lib/feedback";
import type { StoreItem } from "@/lib/store";

export type RevealPrize = { kind: "coins"; amount: number } | { kind: "item"; item: StoreItem };

type Props = {
  prize: RevealPrize | null;
  /** Heading above the box, e.g. "Daily Challenge reward". */
  title: string;
  onClose: () => void;
  /** Offered for wearable items: put it on straight away. */
  onWear?: (item: StoreItem) => void | Promise<void>;
  /** The player's avatar, to show the item being worn. */
  avatar?: { avatarId: string; outfit: Outfit };
};

const RAY_COLORS: Record<string, string> = {
  common: "rgba(255,255,255,0.35)",
  rare: "rgba(56,189,248,0.45)",
  epic: "rgba(217,70,239,0.5)",
  legendary: "rgba(251,191,36,0.6)",
};

/**
 * Mystery-box reveal: a gift box wobbles, the player taps it (or it opens by
 * itself after a moment), it bursts open with light rays and confetti, and
 * the prize pops out with its rarity.
 */
export function RewardReveal({ prize, title, onClose, onWear, avatar }: Props) {
  const reduced = useReducedMotion();
  const [stage, setStage] = useState<"box" | "open">("box");
  const [confetti, setConfetti] = useState(0);
  const [wearing, setWearing] = useState(false);
  const opened = useRef(false);

  useEffect(() => {
    if (!prize) return;
    opened.current = false;
    setStage("box");
    setWearing(false);
  }, [prize]);

  // Opens by itself if the player doesn't tap, so it never gets stuck.
  useEffect(() => {
    if (!prize || stage !== "box") return;
    const t = window.setTimeout(() => open(), reduced ? 300 : 2200);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prize, stage, reduced]);

  function open() {
    if (opened.current) return;
    opened.current = true;
    feedback("correct");
    setConfetti((n) => n + 1);
    setStage("open");
  }

  const rarity = prize?.kind === "item" ? rarityOf(prize.item) : "common";
  const rays = RAY_COLORS[rarity];
  const wearable =
    prize?.kind === "item" && prize.item.category !== "theme" && prize.item.category !== "boost";
  const tryOn =
    prize?.kind === "item" && avatar
      ? prize.item.category === "avatar"
        ? { avatarId: prize.item.id, outfit: avatar.outfit }
        : {
            avatarId: avatar.avatarId,
            outfit: { ...avatar.outfit, [prize.item.category]: prize.item.id },
          }
      : null;

  return (
    <AnimatePresence>
      {prize && (
        <motion.div
          key="reward-reveal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="overlay-scroll fixed inset-0 z-[80] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-label={title}
          onClick={stage === "open" ? onClose : undefined}
        >
          <ConfettiBurst trigger={confetti} />
          <div
            className="relative flex w-full max-w-sm flex-col items-center text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-white/70">
              {title}
            </p>

            <div className="relative mt-4 flex h-64 w-64 items-center justify-center short:mt-1 short:h-44 short:w-44">
              {/* Light rays behind the prize */}
              {stage === "open" && (
                <motion.div
                  aria-hidden
                  className="absolute inset-[-30%] rounded-full"
                  style={{
                    background: `repeating-conic-gradient(from 0deg, ${rays} 0deg 10deg, transparent 10deg 24deg)`,
                    maskImage: "radial-gradient(circle, black 20%, transparent 68%)",
                    WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 68%)",
                  }}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1, rotate: reduced ? 0 : 360 }}
                  transition={{
                    opacity: { duration: 0.4 },
                    scale: { duration: 0.5 },
                    rotate: { duration: 14, repeat: Infinity, ease: "linear" },
                  }}
                />
              )}

              <AnimatePresence mode="wait">
                {stage === "box" ? (
                  <motion.button
                    key="box"
                    type="button"
                    onClick={open}
                    aria-label="Open your reward"
                    className="relative text-[7.5rem] leading-none focus-visible:outline-none"
                    initial={{ scale: 0, rotate: -20 }}
                    animate={
                      reduced
                        ? { scale: 1, rotate: 0 }
                        : { scale: [1, 1.06, 1], rotate: [0, -10, 10, -8, 8, 0] }
                    }
                    exit={{ scale: 1.6, opacity: 0, transition: { duration: 0.25 } }}
                    transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 0.3 }}
                  >
                    🎁
                    <motion.span
                      aria-hidden
                      className="absolute -right-2 -top-2 text-3xl"
                      animate={{ opacity: [0, 1, 0], scale: [0.6, 1.2, 0.6] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    >
                      ✨
                    </motion.span>
                  </motion.button>
                ) : (
                  <motion.div
                    key="prize"
                    className="relative flex flex-col items-center"
                    initial={{ scale: 0, y: 40, rotate: -25 }}
                    animate={{ scale: 1, y: 0, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 260, damping: 14 }}
                  >
                    {prize.kind === "coins" ? (
                      <motion.div
                        animate={reduced ? undefined : { rotateY: [0, 360] }}
                        transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                      >
                        <CoinIcon size={120} />
                      </motion.div>
                    ) : tryOn ? (
                      <AvatarFigure
                        avatarId={tryOn.avatarId}
                        outfit={tryOn.outfit}
                        className="text-[6.5rem]"
                      />
                    ) : prize.item.category === "avatar" ? (
                      <AnimatedAvatar avatarId={prize.item.id} className="text-[7rem]" />
                    ) : (
                      <span className="text-[7rem] leading-none">{prize.item.emoji}</span>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {stage === "box" ? (
              <p className="mt-2 text-sm font-bold text-white/80">Tap the box to open it!</p>
            ) : (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mt-1 flex w-full flex-col items-center"
              >
                {prize.kind === "coins" ? (
                  <p className="font-display text-3xl font-black text-yellow-200">
                    +{prize.amount} bonus coins!
                  </p>
                ) : (
                  <>
                    <p
                      className={`text-[11px] font-black uppercase tracking-[0.3em] ${RARITY_STYLE[rarity].text}`}
                    >
                      {prize.item.dropOnly ? "Special drop" : RARITY_STYLE[rarity].label}
                    </p>
                    <p className="mt-1 font-display text-3xl font-black text-white">
                      {prize.item.emoji} {prize.item.name}
                    </p>
                    <p className="mt-1 text-sm text-white/70">{prize.item.description}</p>
                  </>
                )}
                <div className="mt-5 flex w-full gap-2">
                  {prize.kind === "item" && wearable && onWear && (
                    <button
                      type="button"
                      disabled={wearing}
                      onClick={async () => {
                        setWearing(true);
                        try {
                          await onWear(prize.item);
                          onClose();
                        } finally {
                          setWearing(false);
                        }
                      }}
                      className="flex-1 rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] disabled:opacity-60"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      {wearing ? "Putting it on…" : "Wear it now"}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="flex-1 rounded-full bg-white/15 px-4 py-3 text-sm font-black text-white"
                  >
                    {prize.kind === "item" ? "Keep it" : "Awesome!"}
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
