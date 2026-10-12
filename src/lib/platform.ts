// Detects the Android/iOS app shells (mobile/), which load this site with a
// "WhyNativeApp" user-agent marker. Store rules mean some web features must
// not appear there: Google/Apple sign-in, web payments and 18+ mode.
import { useEffect, useState } from "react";

export const NATIVE_UA_MARKER = "WhyNativeApp";

export function isNativeApp(): boolean {
  if (typeof navigator === "undefined") return false;
  if (navigator.userAgent.includes(NATIVE_UA_MARKER)) return true;
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

/**
 * null while unknown (server render and first paint), then true/false.
 * Render web-only features only when this is `false`, so they never flash
 * inside the apps.
 */
export function useIsNativeApp(): boolean | null {
  const [native, setNative] = useState<boolean | null>(null);
  useEffect(() => setNative(isNativeApp()), []);
  return native;
}
