import { useEffect, useState } from "react";
import { getSettings, type Settings } from "@/lib/store";

/** Root font size for each text-size choice (everything is sized in rem). */
export const TEXT_SCALE: Record<Settings["textSize"], string> = {
  normal: "",
  large: "112.5%",
  larger: "125%",
};

export function applyDisplayPrefs(s: Pick<Settings, "reduceMotion" | "textSize">) {
  const root = document.documentElement;
  root.classList.toggle("reduce-motion", s.reduceMotion);
  root.style.fontSize = TEXT_SCALE[s.textSize] ?? "";
}

/**
 * Applies the reader's text size and motion choices (Settings → Preferences)
 * and returns whether motion should be reduced, for framer-motion.
 */
export function useDisplayPrefs(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const sync = () => {
      const s = getSettings();
      applyDisplayPrefs(s);
      setReduce(s.reduceMotion);
    };
    sync();
    window.addEventListener("why:settings", sync);
    return () => window.removeEventListener("why:settings", sync);
  }, []);
  return reduce;
}
