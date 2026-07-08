import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getStreak } from "@/lib/store";
import { milestoneFor, type StreakMilestone } from "@/components/StreakBadges";
import { StreakMilestoneCelebration } from "@/components/StreakMilestoneCelebration";
import { analytics } from "@/lib/analytics";

const KEY_SEEN = "why:seenStreakMilestone";

/**
 * Global streak milestone watcher. Mount once at the root. Whenever the
 * persisted streak crosses a milestone via ANY flow (chains, favourites,
 * missions, quiz, category, daily challenge, sync from server, etc.),
 * it shows the celebration overlay and fires analytics events.
 */
export function GlobalStreakMilestoneWatcher() {
  const [milestone, setMilestoneState] = useState<StreakMilestone | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function check() {
      const streak = getStreak();
      const current = milestoneFor(streak);
      let seen = 0;
      try {
        seen = Number(sessionStorage.getItem(KEY_SEEN) ?? "0") || 0;
      } catch {
        seen = 0;
      }

      // First run: seed baseline silently so we only celebrate future crossings.
      if (!bootstrapped.current) {
        bootstrapped.current = true;
        if (current && current.days > seen) {
          sessionStorage.setItem(KEY_SEEN, String(current.days));
        }
        return;
      }

      if (current && current.days > seen) {
        sessionStorage.setItem(KEY_SEEN, String(current.days));
        analytics.streakMilestoneUnlocked(current.days, current.label, "global_watcher");
        toast.success(
          `${current.emoji} ${current.label} unlocked! ${current.days}-day streak!`,
          { duration: 5000, className: "font-bold" },
        );
        setMilestoneState(current);
      } else if (current && current.days < seen) {
        // Streak dropped below a previously celebrated milestone — reset baseline
        // so the user can celebrate reaching it again.
        sessionStorage.setItem(KEY_SEEN, String(current.days));
      } else if (!current && seen > 0) {
        sessionStorage.setItem(KEY_SEEN, "0");
      }
    }

    check();

    // React to changes made in this tab...
    const interval = window.setInterval(check, 2000);
    // ...and in other tabs / after login sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "why:streak" || e.key === KEY_SEEN) check();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") check();
    };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return (
    <StreakMilestoneCelebration
      milestone={milestone}
      source="global_watcher"
      onClose={() => setMilestoneState(null)}
    />
  );
}
