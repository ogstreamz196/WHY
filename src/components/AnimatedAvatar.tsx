import { motion } from "framer-motion";
import { avatarEmojiFor, avatarAnimationFor, type AnimatedAvatarKind } from "@/lib/store";

type Props = {
  avatarId: string | null | undefined;
  /** Force an animation kind (overrides catalog lookup). */
  kind?: AnimatedAvatarKind;
  /** Font size / dimension for the emoji (Tailwind class). */
  className?: string;
  /** Disable motion (respects reduced-motion elsewhere too). */
  static_?: boolean;
};

/**
 * Renders an emoji avatar. If the avatar has a registered animation kind
 * (VIP-exclusive animated avatars), also renders orbital / particle effects
 * around it. Otherwise it's a plain emoji.
 */
export function AnimatedAvatar({ avatarId, kind, className = "text-5xl", static_ }: Props) {
  const emoji = avatarEmojiFor(avatarId);
  const animation = kind ?? avatarAnimationFor(avatarId);

  if (!animation || static_) {
    return (
      <span className={`inline-block leading-none ${className}`} aria-hidden>
        {emoji}
      </span>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center">
      <FxLayer kind={animation} />
      <motion.span
        className={`relative z-10 inline-block leading-none ${className}`}
        aria-hidden
        {...emojiMotionFor(animation)}
      >
        {emoji}
      </motion.span>
    </div>
  );
}

function emojiMotionFor(kind: AnimatedAvatarKind) {
  switch (kind) {
    case "bounce-glow":
      return {
        animate: { y: [0, -8, 0], scale: [1, 1.05, 1] },
        transition: { duration: 1.2, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "spin-sparkle":
      return {
        animate: { rotate: [0, 360] },
        transition: { duration: 6, repeat: Infinity, ease: "linear" as const },
      };
    case "flame-swirl":
      return {
        animate: {
          scale: [1, 1.08, 1],
          filter: [
            "drop-shadow(0 0 6px #ff6b00)",
            "drop-shadow(0 0 14px #ffd93d)",
            "drop-shadow(0 0 6px #ff6b00)",
          ],
        },
        transition: { duration: 1.3, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "wobble":
      return {
        animate: { rotate: [-8, 8, -8], y: [0, -3, 0] },
        transition: { duration: 1.4, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "comet-trail":
      return {
        animate: { x: [-4, 4, -4], y: [4, -4, 4], rotate: [-6, 6, -6] },
        transition: { duration: 1.8, repeat: Infinity, ease: "easeInOut" as const },
      };
    case "orbit-stars":
    case "rainbow-halo":
    case "lightning":
    case "heart-burst":
    default:
      return {
        animate: { scale: [1, 1.04, 1] },
        transition: { duration: 1.6, repeat: Infinity, ease: "easeInOut" as const },
      };
  }
}

function FxLayer({ kind }: { kind: AnimatedAvatarKind }) {
  switch (kind) {
    case "orbit-stars":
      return (
        <motion.div
          className="pointer-events-none absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
        >
          {["⭐", "✨", "⭐"].map((s, i) => (
            <span
              key={i}
              className="absolute left-1/2 top-1/2 text-[0.55em]"
              style={{
                transform: `rotate(${i * 120}deg) translateY(-140%) rotate(${-i * 120}deg)`,
              }}
            >
              {s}
            </span>
          ))}
        </motion.div>
      );

    case "rainbow-halo":
      return (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-15%] rounded-full blur-[6px] opacity-80"
          style={{
            background:
              "conic-gradient(from 0deg, #ff5f6d, #ffc371, #47ffbc, #38a1ff, #a557ff, #ff5f6d)",
            mask: "radial-gradient(circle, transparent 55%, black 58%, black 72%, transparent 75%)",
            WebkitMask:
              "radial-gradient(circle, transparent 55%, black 58%, black 72%, transparent 75%)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
        />
      );

    case "flame-swirl":
      return (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[-20%] rounded-full blur-xl"
            style={{
              background: "conic-gradient(from 0deg, #ff6b00, #ffd93d, #ff2d55, #ff6b00)",
            }}
            animate={{ rotate: 360, opacity: [0.5, 0.9, 0.5] }}
            transition={{
              rotate: { duration: 4, repeat: Infinity, ease: "linear" },
              opacity: { duration: 1.4, repeat: Infinity, ease: "easeInOut" },
            }}
          />
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute text-[0.5em]"
              style={{ left: `${20 + i * 30}%`, top: "-30%" }}
              animate={{ y: [0, -8, 0], opacity: [0.6, 1, 0.6] }}
              transition={{
                duration: 1 + i * 0.2,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.15,
              }}
            >
              🔥
            </motion.span>
          ))}
        </>
      );

    case "spin-sparkle":
      return (
        <>
          {["✨", "💫", "✨", "💫"].map((s, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute text-[0.45em]"
              style={{
                left: `${20 + (i % 2) * 60}%`,
                top: `${10 + Math.floor(i / 2) * 70}%`,
              }}
              animate={{ scale: [0, 1.2, 0], rotate: [0, 180] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
            >
              {s}
            </motion.span>
          ))}
        </>
      );

    case "comet-trail":
      return (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="absolute left-1/2 top-1/2 h-[3px] w-[130%] -translate-x-1/2 -translate-y-1/2 rotate-[135deg] rounded-full blur-[2px]"
            style={{
              background: "linear-gradient(90deg, transparent, #7dd3fc, #a78bfa, transparent)",
            }}
          />
        </motion.div>
      );

    case "heart-burst":
      return (
        <>
          {["💖", "💕", "💗"].map((s, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute text-[0.45em]"
              style={{ left: `${25 + i * 25}%`, top: "60%" }}
              animate={{ y: [0, -30], opacity: [1, 0], scale: [0.6, 1.1] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay: i * 0.4 }}
            >
              {s}
            </motion.span>
          ))}
        </>
      );

    case "lightning":
      return (
        <>
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-[-10%] rounded-full"
            style={{
              background: "radial-gradient(circle, rgba(255,236,102,0.55), transparent 65%)",
            }}
            animate={{ opacity: [0.2, 1, 0.2] }}
            transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut" }}
          />
          {["⚡", "⚡"].map((s, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="pointer-events-none absolute text-[0.5em]"
              style={{ left: i === 0 ? "-10%" : "85%", top: `${10 + i * 60}%` }}
              animate={{ opacity: [0, 1, 0], scale: [0.7, 1.2, 0.7] }}
              transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: i * 0.3 }}
            >
              {s}
            </motion.span>
          ))}
        </>
      );

    case "bounce-glow":
      return (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-10%] rounded-full blur-xl"
          style={{ background: "radial-gradient(circle, rgba(120,220,255,0.6), transparent 70%)" }}
          animate={{ opacity: [0.4, 0.9, 0.4], scale: [0.95, 1.1, 0.95] }}
          transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
        />
      );

    case "wobble":
    default:
      return null;
  }
}
