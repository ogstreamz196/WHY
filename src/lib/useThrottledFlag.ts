import { useEffect, useState } from "react";

/**
 * Returns `true` only after `active` has been `true` continuously for
 * `delayMs`. Flips back to `false` immediately when `active` becomes `false`.
 *
 * Used to throttle skeleton placeholders so they don't flicker on fast loads
 * but still appear for slower fetches.
 */
export function useThrottledFlag(active: boolean, delayMs = 180): boolean {
  const [show, setShow] = useState(active && delayMs === 0);
  useEffect(() => {
    if (!active) {
      setShow(false);
      return;
    }
    if (delayMs <= 0) {
      setShow(true);
      return;
    }
    const t = setTimeout(() => setShow(true), delayMs);
    return () => clearTimeout(t);
  }, [active, delayMs]);
  return show;
}
