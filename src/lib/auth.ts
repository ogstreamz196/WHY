// Client-side auth hooks. Keeps the app guest-first: `user` is null for guests,
// populated after sign-in. Reactive via Supabase's onAuthStateChange.
import { useEffect, useState, useCallback } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const isBrowser = () => typeof window !== "undefined";

export function useCurrentUser() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isBrowser()) {
      setLoading(false);
      return;
    }
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setUser(data.session?.user ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_evt, session) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { user, loading, isGuest: !loading && !user };
}

export function useSignOut() {
  return useCallback(async () => {
    await supabase.auth.signOut();
  }, []);
}
