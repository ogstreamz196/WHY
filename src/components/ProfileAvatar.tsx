import { motion, AnimatePresence } from "framer-motion";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";

type Props = {
  avatarId: string | null | undefined;
  isVip?: boolean;
  statusMessage?: string | null;
  /** Tailwind size classes for the outer square container (defaults to full width). */
  className?: string;
  /** Font-size for the emoji (Tailwind text-* utility). Defaults to fluid. */
  emojiClassName?: string;
};

/**
 * Full-bleed profile avatar: fills its container, transparent circular window,
 * animated flame aura + speech-bubble status for VIP members.
 */
export function ProfileAvatar({
  avatarId,
  isVip = false,
  statusMessage,
  className = "aspect-square w-full",
  emojiClassName = "text-[clamp(4rem,18vw,9rem)]",
}: Props) {
  const status = (statusMessage ?? "").trim();


  return (
    <div className={`relative ${className}`}>
      {/* VIP flame aura — layered blurred gradients that pulse and rotate. */}
      {isVip && (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full blur-2xl"
            style={{
              background:
                "conic-gradient(from 0deg, #ff6b00, #ffd93d, #ff2d55, #ff6b00)",
              filter: "blur(28px) saturate(1.4)",
            }}
            animate={{ rotate: 360, scale: [1, 1.08, 1] }}
            transition={{
              rotate: { duration: 8, repeat: Infinity, ease: "linear" },
              scale: { duration: 2.2, repeat: Infinity, ease: "easeInOut" },
            }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[6%] rounded-full blur-xl mix-blend-screen"
            style={{
              background:
                "radial-gradient(circle at 50% 65%, #ffd93d 0%, #ff6b00 45%, transparent 70%)",
            }}
            animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.05, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Flickering flame tongues */}
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute text-3xl select-none"
              style={{
                left: `${18 + i * 16}%`,
                top: "-6%",
                filter: "drop-shadow(0 0 8px #ff6b00)",
              }}
              animate={{
                y: [0, -12, 0],
                opacity: [0.5, 1, 0.5],
                rotate: [-8, 8, -8],
              }}
              transition={{
                duration: 1.1 + i * 0.15,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.12,
              }}
            >
              🔥
            </motion.span>
          ))}
        </>
      )}

      {/* Transparent circular window — the avatar fills the whole thing. */}
      <div
        className={`relative flex h-full w-full items-center justify-center overflow-hidden rounded-full border ${
          isVip ? "border-amber-300/70 shadow-[0_0_40px_rgba(255,140,0,0.55)]" : "border-white/15 shadow-[0_0_24px_rgba(0,0,0,0.35)]"
        }`}
        style={{ background: "transparent" }}
      >
        <span
          className={`leading-none ${emojiClassName}`}
          style={{ filter: isVip ? "drop-shadow(0 0 10px rgba(255,215,0,0.7))" : undefined }}
          role="img"
          aria-label={avatarId ?? "avatar"}
        >
          {emoji}
        </span>
      </div>

      {/* VIP speech-bubble status */}
      <AnimatePresence>
        {isVip && status && (
          <motion.div
            key={status}
            initial={{ opacity: 0, y: 6, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 380, damping: 22 }}
            className="pointer-events-none absolute -top-2 left-[68%] max-w-[70%] rounded-2xl rounded-bl-sm border border-white/70 bg-white px-3 py-1.5 text-xs font-black text-slate-900 shadow-xl"
            role="status"
            aria-label={`Status: ${status}`}
          >
            {status}
            <span
              aria-hidden
              className="absolute -bottom-1.5 left-3 h-3 w-3 rotate-45 border-b border-l border-white/70 bg-white"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
