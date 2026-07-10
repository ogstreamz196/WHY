import { motion } from "framer-motion";
import { useMemo } from "react";

/**
 * Renders `text` word-by-word, each word flying in from the top-right of
 * the parent (as if a circle in that corner is "speaking" the answer)
 * and settling into its natural inline position.
 *
 * The parent must be `relative` for the origin offset to feel anchored
 * to its top-right corner.
 */
export function TalkingWords({
  text,
  stagger = 0.08,
  className,
}: {
  text: string;
  stagger?: number;
  className?: string;
}) {
  // Re-mount on text change so the animation replays for every new answer.
  const words = useMemo(() => text.split(/(\s+)/), [text]);

  return (
    <span key={text} className={className} aria-label={text}>
      {words.map((w, i) =>
        /^\s+$/.test(w) ? (
          <span key={i}> </span>
        ) : (
          <motion.span
            key={i}
            aria-hidden
            className="inline-block will-change-transform"
            initial={{
              opacity: 0,
              x: 180,
              y: -120,
              scale: 0.4,
              rotate: 25,
              filter: "blur(6px)",
            }}
            animate={{
              opacity: 1,
              x: 0,
              y: 0,
              scale: 1,
              rotate: 0,
              filter: "blur(0px)",
            }}
            transition={{
              delay: (i / 2) * stagger,
              type: "spring",
              stiffness: 260,
              damping: 22,
              mass: 0.6,
            }}
          >
            {w}
          </motion.span>
        ),
      )}
    </span>
  );
}
