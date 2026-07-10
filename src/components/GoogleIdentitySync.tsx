import { useEffect, useRef } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useCurrentUser } from "@/lib/auth";
import { syncGoogleIdentityToProfile } from "@/lib/account.functions";

/**
 * Runs once per session when the signed-in user has a Google identity,
 * pulling name + avatar from Google into their local profile. No UI —
 * mount once at the app root.
 */
export function GoogleIdentitySync() {
  const { user } = useCurrentUser();
  const run = useServerFn(syncGoogleIdentityToProfile);
  const qc = useQueryClient();
  const doneFor = useRef<string | null>(null);

  useEffect(() => {
    if (!user || typeof window === "undefined") return;
    const hasGoogle = (user.identities ?? []).some((i) => i.provider === "google");
    if (!hasGoogle) return;
    const key = `why:googlesync:${user.id}`;
    if (doneFor.current === user.id) return;
    if (window.sessionStorage.getItem(key)) {
      doneFor.current = user.id;
      return;
    }
    doneFor.current = user.id;
    run()
      .then((res) => {
        window.sessionStorage.setItem(key, "1");
        if (res?.synced) qc.invalidateQueries({ queryKey: ["profile"] });
      })
      .catch(() => {
        /* silent; will retry next session */
      });
  }, [user, run, qc]);

  return null;
}

export default GoogleIdentitySync;
