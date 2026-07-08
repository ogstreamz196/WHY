// Lightweight client-side analytics. Sends events to any installed provider
// (Plausible, GA4/gtag, PostHog, or the `dataLayer` queue) and always logs to
// the console so events are observable during development. Safe no-op on SSR.

type EventProps = Record<string, string | number | boolean | null | undefined>;

declare global {
  interface Window {
    plausible?: (event: string, opts?: { props?: EventProps }) => void;
    gtag?: (command: "event", event: string, props?: EventProps) => void;
    posthog?: { capture: (event: string, props?: EventProps) => void };
    dataLayer?: Array<{ event: string } & EventProps>;
  }
}

export function trackEvent(event: string, props: EventProps = {}): void {
  if (typeof window === "undefined") return;
  try {
    // Always log so we can see events in dev/preview.
    // eslint-disable-next-line no-console
    console.info("[analytics]", event, props);
    window.plausible?.(event, { props });
    window.gtag?.("event", event, props);
    window.posthog?.capture(event, props);
    window.dataLayer?.push({ event, ...props });
  } catch {
    // never let analytics break the app
  }
}

// Domain-specific helpers keep event names consistent across call sites.
export const analytics = {
  streakMilestoneUnlocked: (days: number, label: string, source: string) =>
    trackEvent("streak_milestone_unlocked", { days, label, source }),
  streakCelebrationRendered: (days: number, label: string, source: string) =>
    trackEvent("streak_celebration_rendered", { days, label, source }),
  streakCelebrationDismissed: (days: number, label: string, source: string) =>
    trackEvent("streak_celebration_dismissed", { days, label, source }),
};
