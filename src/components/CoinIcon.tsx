import type { SVGProps } from "react";

/**
 * Y-coin — the app's currency. Gold coin with an embossed "Y".
 * Uses currentColor for the Y so it can inherit text color where useful.
 */
export function CoinIcon({
  size = 20,
  className,
  ...rest
}: { size?: number; className?: string } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
      {...rest}
    >
      <defs>
        <radialGradient id="coin-face" cx="35%" cy="30%" r="80%">
          <stop offset="0%" stopColor="#fff3b0" />
          <stop offset="55%" stopColor="#f5b833" />
          <stop offset="100%" stopColor="#c47a10" />
        </radialGradient>
        <linearGradient id="coin-rim" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffd76b" />
          <stop offset="100%" stopColor="#8a4d05" />
        </linearGradient>
      </defs>
      <circle cx="12" cy="12" r="11" fill="url(#coin-rim)" />
      <circle cx="12" cy="12" r="9" fill="url(#coin-face)" />
      <circle cx="12" cy="12" r="9" fill="none" stroke="#7a4200" strokeOpacity="0.35" />
      <text
        x="12"
        y="16.4"
        textAnchor="middle"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        fontWeight="900"
        fontSize="12"
        fill="#5a2f00"
      >
        Y
      </text>
    </svg>
  );
}
