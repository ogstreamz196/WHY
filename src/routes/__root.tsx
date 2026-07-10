import "@fontsource/archivo-black/index.css";
import "@fontsource/hind/400.css";
import "@fontsource/hind/500.css";
import "@fontsource/hind/600.css";
import "@fontsource/hind/700.css";
import "@fontsource-variable/fraunces/index.css";
import "@fontsource-variable/plus-jakarta-sans/index.css";
import "@fontsource-variable/fredoka/index.css";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "@/components/ui/sonner";
import { GlobalStreakMilestoneWatcher } from "@/components/GlobalStreakMilestoneWatcher";
import { TopSignInBar } from "@/components/TopSignInBar";
import { ThemeDebugger } from "@/components/ThemeDebugger";
import { FloatingEditToggle } from "@/components/FloatingEditToggle";
import { GoogleIdentitySync } from "@/components/GoogleIdentitySync";
import { EditModeProvider } from "@/lib/editMode";
import { useBossTheme } from "@/lib/useBossTheme";
import { useEquippedTheme } from "@/lib/useEquippedTheme";


import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { CosmicBackground } from "../components/CosmicBackground";

function NotFoundComponent() {
  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4">
      <CosmicBackground />
      <div className="glass-strong max-w-md rounded-4xl p-8 text-center">
        <h1 className="text-7xl font-black text-gradient font-display">404</h1>
        <h2 className="mt-4 text-xl font-bold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This corner of the universe doesn't exist yet.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            Back to WHY?
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="relative flex min-h-[100dvh] items-center justify-center px-4">
      <CosmicBackground />
      <div className="glass-strong max-w-md rounded-4xl p-8 text-center">
        <h1 className="text-xl font-bold text-foreground">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong. Try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            Try again
          </button>
          <a
            href="/"
            className="rounded-full border border-white/15 bg-white/5 px-5 py-2.5 text-sm font-bold text-foreground"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "Why? — A pocket-sized universe of curiosity" },
      { name: "description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
      { name: "theme-color", content: "#100c1f" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "Why?" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { property: "og:title", content: "Why? — A pocket-sized universe of curiosity" },
      { property: "og:description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Why? — A pocket-sized universe of curiosity" },
      { name: "twitter:description", content: "Do you know why…? A never-ending stream of child-friendly, fun and educational facts." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e2e6a6b5-651b-46d0-b961-f1c8157d7e00/id-preview-86c535ee--c58b4bae-8420-4813-8e35-37776e764a70.lovable.app-1783527414073.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/e2e6a6b5-651b-46d0-b961-f1c8157d7e00/id-preview-86c535ee--c58b4bae-8420-4813-8e35-37776e764a70.lovable.app-1783527414073.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  useBossTheme();
  useEquippedTheme();


  useEffect(() => {
    if (typeof window === "undefined") return;
    // Lazy import so this stays client-only
    let unsub: (() => void) | undefined;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
          router.invalidate();
          if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
        }
      });
      unsub = () => data.subscription.unsubscribe();
    });
    return () => { unsub?.(); };
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <EditModeProvider>
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[100] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-black"
        >
          Skip to content
        </a>
        <div id="main" tabIndex={-1}>
          <Outlet />
        </div>
        <GlobalStreakMilestoneWatcher />
        <TopSignInBar />
        <GoogleIdentitySync />
        <FloatingEditToggle />
        <ThemeDebugger />
        <Toaster theme="dark" position="top-center" richColors closeButton />
      </EditModeProvider>
    </QueryClientProvider>
  );
}
