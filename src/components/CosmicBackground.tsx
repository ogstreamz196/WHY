/**
 * Deterministic pseudo-random so the server-rendered HTML and the hydrated
 * client markup match exactly (Math.random() would mismatch on every load).
 */
function seeded(n: number) {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

const STARS = Array.from({ length: 40 }, (_, i) => ({
  id: i,
  top: +(seeded(i + 1) * 100).toFixed(4),
  left: +(seeded(i + 101) * 100).toFixed(4),
  size: +(seeded(i + 201) * 2 + 1).toFixed(4),
  delay: +(seeded(i + 301) * 3).toFixed(4),
  duration: +(2 + seeded(i + 401) * 3).toFixed(4),
}));

/** Deep-space animated background with drifting nebulae + twinkling stars. */
export function CosmicBackground() {
  const stars = STARS;

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--gradient-space)" }} />
      {/* Equipped theme tint — sits above space bg, below nebulae */}
      <div
        aria-hidden
        className="absolute inset-0 transition-opacity duration-500"
        style={{
          background: "var(--theme-gradient, transparent)",
          opacity: 0.35,
          mixBlendMode: "soft-light",
        }}
      />

      <div
        className="absolute -left-40 top-20 h-96 w-96 rounded-full opacity-30 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.24 305), transparent 70%)" }}
      />
      <div
        className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl animate-float-slow"
        style={{
          animationDelay: "1.5s",
          background: "radial-gradient(circle, oklch(0.72 0.20 195), transparent 70%)",
        }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl animate-float-slow"
        style={{
          animationDelay: "3s",
          background: "radial-gradient(circle, oklch(0.72 0.24 340), transparent 70%)",
        }}
      />
      {/* Stars */}
      {stars.map((s) => (
        <div
          key={s.id}
          className="absolute rounded-full bg-white animate-twinkle"
          style={{
            top: `${s.top}%`,
            left: `${s.left}%`,
            width: `${s.size}px`,
            height: `${s.size}px`,
            animationDelay: `${s.delay}s`,
            animationDuration: `${s.duration}s`,
            boxShadow: "0 0 6px currentColor",
          }}
        />
      ))}
    </div>
  );
}
