// Floating "install the app" banner for the website only. It shows on every
// visit until we detect the app is installed (opened from the home screen,
// or the browser reports a finished install). Closing it only hides it for
// the current visit. Never shown inside the Android/iOS apps.
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useIsNativeApp } from "@/lib/platform";

const INSTALLED_KEY = "why:app_installed";
const HIDDEN_KEY = "why:install_banner_hidden";

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

export function InstallAppBanner() {
  const native = useIsNativeApp();
  const [show, setShow] = useState(false);
  const [prompt, setPrompt] = useState<PromptEvent | null>(null);
  const [ios, setIos] = useState(false);
  const [iosHelp, setIosHelp] = useState(false);

  useEffect(() => {
    if (native !== false) return;
    if (isStandalone()) {
      localStorage.setItem(INSTALLED_KEY, "1");
      return;
    }
    if (localStorage.getItem(INSTALLED_KEY) === "1") return;
    if (sessionStorage.getItem(HIDDEN_KEY) === "1") return;
    if (window.top !== window.self) return; // editor preview frame
    const ua = navigator.userAgent;
    setIos(/iphone|ipad|ipod/i.test(ua) || (ua.includes("Mac") && "ontouchend" in document));
    setShow(true);

    const onPrompt = (e: Event) => {
      // Stop the browser's own mini-infobar; we keep the event so our button
      // can trigger the real install dialog directly.
      e.preventDefault();
      setPrompt(e as PromptEvent);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShow(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [native]);

  if (!show) return null;

  const install = async () => {
    // Direct install: browsers that support beforeinstallprompt (Android,
    // Chrome, Edge) open their own install dialog — no instructions needed.
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      setPrompt(null);
      if (outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setShow(false);
      }
      return;
    }
    // iPhone/iPad only: Apple never lets a website trigger installation, so
    // the Share → Add to Home Screen steps are the only path Apple allows.
    setIosHelp((v) => !v);
  };

  const close = () => {
    sessionStorage.setItem(HIDDEN_KEY, "1");
    setShow(false);
  };

  return (
    <div
      role="region"
      aria-label="Add the Why? shortcut"
      className="safe-x fixed inset-x-0 bottom-[calc(6rem+env(safe-area-inset-bottom))] z-50 short:bottom-[calc(3.5rem+env(safe-area-inset-bottom))]"
    >
      <div className="glass-strong mx-auto flex max-w-2xl flex-col gap-2 rounded-3xl p-3 shadow-[var(--shadow-card)] short:rounded-2xl short:py-1.5">
        <div className="flex items-center gap-3">
          <img
            src="/icon-192.png"
            alt=""
            className="h-11 w-11 shrink-0 rounded-2xl short:h-8 short:w-8"
          />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-foreground">Add the Why? shortcut</p>
            <p className="text-xs text-muted-foreground short:hidden">
              One tap from your home screen. Free!
            </p>
          </div>
          <button
            type="button"
            onClick={install}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Download className="h-4 w-4" /> Add shortcut
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close for now"
            className="shrink-0 rounded-full p-2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {iosHelp && (
          <p className="rounded-2xl bg-muted/40 px-3 py-2 text-xs text-foreground">
            {ios ? (
              <>
                Tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> <b>Share</b> at the bottom of
                Safari, then <b>Add to Home Screen</b>.
              </>
            ) : (
              <>
                Open your browser menu (⋮) and choose <b>Add to Home screen</b>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
