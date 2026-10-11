import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const BOSS_EMAIL = "ogstreamz196@gmail.com";

/**
 * Applies the `.theme-boss` class to <html> whenever the Boss account is
 * signed in. Safe to mount from multiple places — the class toggle is
 * idempotent, so the theme stays consistent across every route and survives
 * refreshes (re-runs on mount + reacts to auth state changes).
 */
export function useBossTheme() {
  const [isBoss, setIsBoss] = useState(false);
  useEffect(() => {
    let alive = true;
    const apply = (boss: boolean) => {
      if (!alive) return;
      setIsBoss(boss);
      document.documentElement.classList.toggle("theme-boss", boss);
    };
    supabase.auth.getUser().then(({ data }) => {
      apply(data.user?.email?.toLowerCase() === BOSS_EMAIL);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      apply(session?.user?.email?.toLowerCase() === BOSS_EMAIL);
    });
    return () => {
      alive = false;
      sub.subscription.unsubscribe();
    };
  }, []);
  return isBoss;
}
