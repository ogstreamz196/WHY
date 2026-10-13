import { useId } from "react";

/**
 * The Why? logo: a chunky question mark in its own little orbit, with a
 * sparkling star for the dot. The same drawing is in public/logo.svg, which
 * the web icons and the share image are made from.
 */
export function WhyLogo({
  size = 40,
  withWordmark = false,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 512 512"
        role="img"
        aria-label="Why?"
        className="shrink-0 drop-shadow-[0_4px_14px_rgba(168,85,247,0.45)]"
      >
        <LogoArt id={id} />
      </svg>
      {withWordmark && (
        <span className="font-display text-2xl font-black leading-none tracking-tight text-white">
          Why<span className="text-amber-300">?</span>
        </span>
      )}
    </span>
  );
}

/** The drawing itself (keep in step with public/logo.svg). */
function LogoArt({ id }: { id: string }) {
  const bg = `${id}-bg`;
  const shine = `${id}-shine`;
  return (
    <>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7c3aed" />
          <stop offset="0.55" stopColor="#db2777" />
          <stop offset="1" stopColor="#f97316" />
        </linearGradient>
        <radialGradient id={shine} cx="0.3" cy="0.2" r="0.8">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="0.6" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${bg})`} />
      <rect width="512" height="512" rx="116" fill={`url(#${shine})`} />
      <ellipse
        cx="256"
        cy="262"
        rx="204"
        ry="74"
        transform="rotate(-22 256 262)"
        fill="none"
        stroke="#ffffff"
        strokeOpacity="0.4"
        strokeWidth="12"
      />
      <circle cx="430" cy="170" r="24" fill="#fde047" />
      <circle cx="422" cy="162" r="8" fill="#ffffff" fillOpacity="0.7" />
      <path
        d="M168 190 C168 124 214 92 262 92 C318 92 352 130 352 178 C352 226 314 246 290 262 C268 277 260 292 260 326"
        fill="none"
        stroke="#ffffff"
        strokeWidth="60"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M260 360 Q268 398 306 406 Q268 414 260 452 Q252 414 214 406 Q252 398 260 360 Z"
        fill="#fde047"
        stroke="#fde047"
        strokeWidth="10"
        strokeLinejoin="round"
      />
    </>
  );
}
