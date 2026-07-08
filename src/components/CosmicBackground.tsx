import { useMemo } from "react";

/** Deep-space animated background with drifting nebulae + twinkling stars. */
export function CosmicBackground() {
  const stars = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        top: Math.random() * 100,
        left: Math.random() * 100,
        size: Math.random() * 2 + 1,
        delay: Math.random() * 3,
        duration: 2 + Math.random() * 3,
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0" style={{ background: "var(--gradient-space)" }} />
      {/* Drifting nebulae blobs */}
      <div
        className="absolute -left-40 top-20 h-96 w-96 rounded-full opacity-30 blur-3xl animate-float-slow"
        style={{ background: "radial-gradient(circle, oklch(0.72 0.24 305), transparent 70%)" }}
      />
      <div
        className="absolute -right-32 top-1/3 h-[28rem] w-[28rem] rounded-full opacity-25 blur-3xl animate-float-slow"
        style={{ animationDelay: "1.5s", background: "radial-gradient(circle, oklch(0.72 0.20 195), transparent 70%)" }}
      />
      <div
        className="absolute bottom-0 left-1/4 h-96 w-96 rounded-full opacity-20 blur-3xl animate-float-slow"
        style={{ animationDelay: "3s", background: "radial-gradient(circle, oklch(0.72 0.24 340), transparent 70%)" }}
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
