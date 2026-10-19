// Slim "add to home screen" bar for the website only. It waits until someone
// has used the site for a bit (sooner on a return visit), never shows while a
// pop-up is open, and stops once the app is installed (opened from the home
// screen, or the browser reports a finished install). Closing it hides it for
// the current visit. Never shown inside the Android/iOS apps.
import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { useIsNativeApp } from "@/lib/platform";

const INSTALLED_KEY = "why:app_installed";
const HIDDEN_KEY = "why:install_banner_hidden";
const VISITS_KEY = "why:visits";
// First visit: let them explore before suggesting anything. Return visits: sooner.
const FIRST_VISIT_DELAY = 60_000;
const RETURN_VISIT_DELAY = 8_000;

function countVisit(): number {
  try {
    if (sessionStorage.getItem(VISITS_KEY)) return Number(localStorage.getItem(VISITS_KEY)) || 1;
    sessionStorage.setItem(VISITS_KEY, "1");
    const n = (Number(localStorage.getItem(VISITS_KEY)) || 0) + 1;
    localStorage.setItem(VISITS_KEY, String(n));
    return n;
  } catch {
    return 1;
  }
}

type PromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

// Set by the early script in __root.tsx, which catches the browser's one-off
// "this site can be installed" event before React has loaded.
type InstallWindow = Window & { __whyInstallPrompt?: PromptEvent | null };

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
  const [modalOpen, setModalOpen] = useState(false);

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
    const delay = countVisit() > 1 ? RETURN_VISIT_DELAY : FIRST_VISIT_DELAY;
    const timer = window.setTimeout(() => setShow(true), delay);

    // The early script keeps the event (and stops the browser's own
    // mini-infobar) so our button can open the real install dialog.
    const w = window as InstallWindow;
    const takePrompt = () => {
      if (w.__whyInstallPrompt) setPrompt(w.__whyInstallPrompt);
    };
    const onInstalled = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShow(false);
    };
    takePrompt();
    window.addEventListener("why:installprompt", takePrompt);
    window.addEventListener("why:appinstalled", onInstalled);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("why:installprompt", takePrompt);
      window.removeEventListener("why:appinstalled", onInstalled);
    };
  }, [native]);

  // Step aside while any pop-up is open.
  useEffect(() => {
    if (!show) return;
    const check = () => setModalOpen(!!document.querySelector('[aria-modal="true"]'));
    check();
    const t = window.setInterval(check, 1000);
    return () => window.clearInterval(t);
  }, [show]);

  if (!show || modalOpen) return null;

  const install = async () => {
    // Direct install: browsers that support beforeinstallprompt (Android,
    // Chrome, Edge) open their own install dialog — no instructions needed.
    if (prompt) {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // A prompt can only be used once.
      setPrompt(null);
      (window as InstallWindow).__whyInstallPrompt = null;
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
      aria-label="Add Why? to your home screen"
      className="safe-x fixed inset-x-0 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 wide:bottom-[calc(1rem+env(safe-area-inset-bottom))] wide:left-[var(--rail-w)]"
    >
      <div className="glass-strong mx-auto flex max-w-md flex-col gap-1.5 rounded-2xl px-2.5 py-1.5 shadow-[var(--shadow-card)]">
        <div className="flex items-center gap-2">
          <img src="/icon-192.png" alt="" className="h-7 w-7 shrink-0 rounded-lg" />
          <p className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">
            Add Why? to your home screen
          </p>
          <button
            type="button"
            onClick={install}
            className="inline-flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold text-primary-foreground"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Download className="h-3.5 w-3.5" /> Add
          </button>
          <button
            type="button"
            onClick={close}
            aria-label="Close for now"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {iosHelp && (
          <p className="rounded-xl bg-muted/40 px-3 py-2 text-xs text-foreground">
            {ios ? (
              <>
                Tap <Share className="mx-0.5 inline h-3.5 w-3.5" /> <b>Share</b> at the bottom of
                Safari, then <b>Add to Home Screen</b>.
              </>
            ) : (
              <>
                Open your browser menu (⋮) and choose <b>Install app</b> or{" "}
                <b>Add to Home screen</b>.
              </>
            )}
          </p>
        )}
      </div>
    </div>
  );
}
