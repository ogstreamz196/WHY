import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getBadges, getPoints, type Badge } from "@/lib/store";
import { levelFor } from "@/lib/levels";

const KEY_SEEN_BADGES = "why:seenBadges";
const KEY_SEEN_LEVEL = "why:seenLevel";

type LevelUp = { level: number; title: string } | null;

/**
 * Watches badges + XP level for new unlocks and:
 *   - fires a sonner toast per newly unlocked badge
 *   - increments a `confettiTrigger` (to render a burst)
 *   - surfaces a `levelUp` payload for the LevelUpCelebration modal
 *
 * Persists what has already been celebrated in localStorage so the same
 * unlock never fires twice.
 */
export function useUnlockWatcher(refreshKey: unknown = null) {
  const [confettiTrigger, setConfettiTrigger] = useState(0);
  const [levelUp, setLevelUp] = useState<LevelUp>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const badges: Badge[] = getBadges();
    const unlockedIds = badges.filter((b) => b.unlocked).map((b) => b.id);
    const points = getPoints();
    const level = levelFor(points).level;

    let seenIds: string[] = [];
    try {
      seenIds = JSON.parse(localStorage.getItem(KEY_SEEN_BADGES) ?? "[]");
    } catch {
      seenIds = [];
    }
    const seenLevel = Number(localStorage.getItem(KEY_SEEN_LEVEL) ?? "0");

    // First run of the session: silently seed baseline so we only celebrate
    // *future* unlocks, not everything the user already has.
    if (!bootstrapped.current && seenIds.length === 0 && seenLevel === 0) {
      localStorage.setItem(KEY_SEEN_BADGES, JSON.stringify(unlockedIds));
      localStorage.setItem(KEY_SEEN_LEVEL, String(level));
      bootstrapped.current = true;
      return;
    }
    bootstrapped.current = true;

    const newBadges = badges.filter((b) => b.unlocked && !seenIds.includes(b.id));
    if (newBadges.length > 0) {
      newBadges.forEach((b, idx) => {
        setTimeout(() => {
          toast.success(`Badge unlocked: ${b.label}`, {
            description: "Tap Badges to see your collection.",
            icon: <span className="text-lg">{b.emoji}</span>,
          });
        }, idx * 350);
      });
      setConfettiTrigger((n) => n + 1);
      localStorage.setItem(KEY_SEEN_BADGES, JSON.stringify(unlockedIds));
    }

    if (level > seenLevel) {
      const info = levelFor(points);
      setLevelUp({ level: info.level, title: info.title });
      setConfettiTrigger((n) => n + 1);
      localStorage.setItem(KEY_SEEN_LEVEL, String(level));
    }
  }, [refreshKey]);

  return {
    confettiTrigger,
    levelUp,
    dismissLevelUp: () => setLevelUp(null),
  };
}
