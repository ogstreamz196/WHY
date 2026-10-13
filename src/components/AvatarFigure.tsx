import { motion, useReducedMotion } from "framer-motion";
import { AnimatedAvatar } from "@/components/AnimatedAvatar";
import { AURA_LOOK, type Outfit } from "@/lib/avatarItems";
import { itemById } from "@/lib/store";

type Props = {
  avatarId: string | null | undefined;
  outfit?: Outfit | null;
  /** Sets the size: the character is 1em, so use a text-* class. */
  className?: string;
  /** No looping motion (long lists such as the Ranks page). */
  still?: boolean;
  label?: string;
};

/**
 * A dressed-up avatar: the character plus whatever they're wearing, layered
 * like a paper doll. Hat on top, face gear over the eyes, something in the
 * hand, jewellery at the neck, a pet at their feet and an aura behind.
 * Everything is sized in em, so it scales with the font size you give it.
 */
export function AvatarFigure({ avatarId, outfit, className = "text-6xl", still, label }: Props) {
  const reduced = useReducedMotion();
  const calm = !!(still || reduced);
  const o = outfit ?? {};
  const emoji = (id?: string) => itemById(id)?.emoji;
  const hat = emoji(o.hat);
  const face = emoji(o.face);
  const hand = emoji(o.hand);
  const neck = emoji(o.neck);
  const pet = emoji(o.pet);
  const aura = o.aura ? AURA_LOOK[o.aura] : undefined;

  return (
    <span
      className={`relative inline-block shrink-0 align-middle leading-none ${className}`}
      style={{ width: "1.5em", height: "1.5em" }}
      role="img"
      aria-label={label ?? "Avatar"}
    >
      {aura && (
        <>
          <motion.span
            aria-hidden
            className="absolute inset-[4%] rounded-full"
            style={{
              background: aura.glow.startsWith("conic")
                ? aura.glow
                : `radial-gradient(circle, ${aura.glow} 0%, transparent 68%)`,
              filter: "blur(0.12em)",
              opacity: aura.glow.startsWith("conic") ? 0.55 : 1,
            }}
            animate={calm ? undefined : { scale: [1, 1.08, 1], rotate: [0, 180, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              aria-hidden
              className="absolute"
              style={{
                fontSize: "0.24em",
                left: `${[8, 78, 70][i]}%`,
                top: `${[18, 10, 72][i]}%`,
              }}
              animate={calm ? undefined : { y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: 1.8 + i * 0.4, repeat: Infinity, delay: i * 0.3 }}
            >
              {aura.particle}
            </motion.span>
          ))}
        </>
      )}

      {/* The character */}
      <span
        className="absolute left-1/2 top-[56%] -translate-x-1/2 -translate-y-1/2"
        style={{ fontSize: "1em" }}
      >
        <AnimatedAvatar avatarId={avatarId} className="text-[1em]" static_={calm} />
      </span>

      {neck && (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2"
          style={{ fontSize: "0.36em", bottom: "0.02em" }}
        >
          {neck}
        </span>
      )}
      {face && (
        <span
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2"
          style={{ fontSize: "0.55em", top: "0.42em" }}
        >
          {face}
        </span>
      )}
      {hat && (
        <motion.span
          aria-hidden
          className="absolute left-1/2"
          style={{ fontSize: "0.58em", top: "-0.12em", x: "-50%", rotate: -8 }}
          animate={calm ? undefined : { rotate: [-8, -3, -8] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
        >
          {hat}
        </motion.span>
      )}
      {hand && (
        <motion.span
          aria-hidden
          className="absolute"
          style={{ fontSize: "0.55em", right: "-0.08em", bottom: "0.1em", rotate: 14 }}
          animate={calm ? undefined : { rotate: [14, 2, 14] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {hand}
        </motion.span>
      )}
      {pet && (
        <motion.span
          aria-hidden
          className="absolute"
          style={{ fontSize: "0.44em", left: "-0.1em", bottom: "-0.02em" }}
          animate={calm ? undefined : { y: [0, -5, 0] }}
          transition={{ duration: 0.9, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.2 }}
        >
          {pet}
        </motion.span>
      )}
    </span>
  );
}
