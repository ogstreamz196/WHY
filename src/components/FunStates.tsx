import type { ReactNode } from "react";

/**
 * Shimmering skeleton block. Use in place of "Loading…" text.
 * Respects the `.skeleton-fun` utility from styles.css.
 */
export function SkeletonBlock({
  className = "",
  lines = 1,
  height = "1rem",
}: {
  className?: string;
  lines?: number;
  height?: string;
}) {
  if (lines <= 1) {
    return (
      <div
        role="status"
        aria-label="Loading"
        className={`skeleton-fun ${className}`}
        style={{ height }}
      />
    );
  }
  return (
    <div role="status" aria-label="Loading" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="skeleton-fun"
          style={{ height, width: i === lines - 1 ? "70%" : "100%" }}
        />
      ))}
    </div>
  );
}

/**
 * Friendly empty state with an emoji, headline and helpful CTA slot.
 */
export function EmptyState({
  emoji = "✨",
  title,
  hint,
  action,
  className = "",
}: {
  emoji?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`empty-fun ${className}`} role="status" aria-live="polite">
      <div className="text-4xl" aria-hidden>
        {emoji}
      </div>
      <p className="font-fun text-[clamp(1.1rem,2.8vw,1.4rem)] font-bold text-white">{title}</p>
      {hint && <p className="font-fun text-[clamp(0.9rem,2.2vw,1.05rem)] text-white/80">{hint}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}
