import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Sparkles, UserPlus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";

type Props = {
  open: boolean;
  seconds: number;
  onClose: () => void;
};

/**
 * A friendly guest-only nudge that shows up every few facts.
 * The close button "runs away" from the cursor for `seconds` seconds while
 * a countdown ticks down — but it only dodges DOWN/RIGHT so the cursor
 * naturally slides onto the big "Sign in with Google" button.
 *
 * If the user cancels (clicks the close button after the lock expires),
 * a 5-second countdown runs before the popup actually closes.
 */
export function GuestSignUpPopup({ open, seconds, onClose }: Props) {
  const [remaining, setRemaining] = useState(seconds);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [oops, setOops] = useState<{ id: number; x: number; y: number } | null>(null);
  const [cancelCountdown, setCancelCountdown] = useState<number | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleClicking, setGoogleClicking] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);
  const googleRef = useRef<HTMLButtonElement | null>(null);
  const oopsId = useRef(0);

  // Detect Apple devices (iOS, iPadOS, macOS) to prefer Apple Sign In.
  const [isApple, setIsApple] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const platform = (navigator as Navigator & { platform?: string }).platform || "";
    const iOS = /iPad|iPhone|iPod/.test(ua) || /iPad|iPhone|iPod/.test(platform);
    const iPadOS = platform === "MacIntel" && (navigator.maxTouchPoints ?? 0) > 1;
    const mac = /Macintosh|Mac OS X/.test(ua);
    setIsApple(iOS || iPadOS || mac);
  }, []);

  const provider: "apple" | "google" = isApple ? "apple" : "google";
  const providerLabel = isApple ? "Apple" : "Google";

  useEffect(() => {
    if (!open) return;
    setRemaining(seconds);
    setOffset({ x: 0, y: 0 });
    setCancelCountdown(null);
    const interval = window.setInterval(() => {
      setRemaining((s) => (s > 0 ? s - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [open, seconds]);

  // Cancel countdown → auto-close when it hits 0
  useEffect(() => {
    if (cancelCountdown === null) return;
    if (cancelCountdown <= 0) {
      onClose();
      return;
    }
    const t = window.setTimeout(() => setCancelCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => window.clearTimeout(t);
  }, [cancelCountdown, onClose]);

  const locked = remaining > 0;

  // Move the popup so the Google button lands directly under the given point.
  // Used both for hover-dodge (desktop) and the close-button bait-and-switch.
  const slideGoogleUnder = (clientX: number, clientY: number, showOops = true) => {
    const el = boxRef.current;
    const gbtn = googleRef.current;
    if (!el) return;

    let nx = offset.x;
    let ny = offset.y;
    if (gbtn) {
      const gr = gbtn.getBoundingClientRect();
      const gcx = gr.left + gr.width / 2;
      const gcy = gr.top + gr.height / 2;
      nx = offset.x + (clientX - gcx);
      ny = offset.y + (clientY - gcy);
    }

    // Clamp so popup stays fully on-screen (works on mobile too).
    const r = el.getBoundingClientRect();
    const pad = 8;
    const minX = offset.x - (r.left - pad);
    const maxX = offset.x + (window.innerWidth - r.right - pad);
    const minY = offset.y - (r.top - pad);
    const maxY = offset.y + (window.innerHeight - r.bottom - pad);
    nx = Math.min(Math.max(nx, minX), maxX);
    ny = Math.min(Math.max(ny, minY), maxY);

    setOffset({ x: nx, y: ny });

    if (showOops) {
      oopsId.current += 1;
      const id = oopsId.current;
      setOops({ id, x: clientX, y: clientY });
      window.setTimeout(() => {
        setOops((o) => (o && o.id === id ? null : o));
      }, 900);
    }
  };

  const dodge = (clientX: number, clientY: number) => {
    if (!locked) return;
    slideGoogleUnder(clientX, clientY, true);
  };

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result?.error) {
        setGoogleLoading(false);
        const msg = (result.error as { message?: string })?.message?.toLowerCase() ?? "";
        if (msg.includes("popup") || msg.includes("blocked") || msg.includes("window")) {
          toast.error(`${providerLabel} sign-in was blocked`, {
            description: "Your browser blocked the popup. Please allow popups and try again.",
          });
        } else {
          toast.error(`Couldn't open ${providerLabel} sign-in`, {
            description: result.error?.message || "Please try again in a moment.",
          });
        }
      }
    } catch (err) {
      setGoogleLoading(false);
      const msg = err instanceof Error ? err.message : "Please try again.";
      toast.error(`${providerLabel} sign-in failed to open`, { description: msg });
    }
  }

  // First press of the close (X) button pulls the Google button under the
  // user's finger/cursor AND immediately triggers Google sign-in — so the
  // action they see is the Google OAuth flow opening, exactly as if they
  // had tapped the Google button.
  function handleCloseClick(e: React.MouseEvent<HTMLButtonElement>) {
    if (locked) return;
    if (cancelCountdown !== null) {
      // Countdown already running → this press cancels it (Keep open).
      setCancelCountdown(null);
      return;
    }
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const cx = e.clientX || rect.left + rect.width / 2;
    const cy = e.clientY || rect.top + rect.height / 2;
    slideGoogleUnder(cx, cy, false);
    // Timing tuned so the ~280ms ripple animation completes just before the
    // OAuth window opens on both iOS Safari and Android Chrome, which can
    // throttle frames when a new tab is about to steal focus:
    //   • 240ms → popup finishes its glide, ripple starts
    //   • 520ms → ripple animation ends (240 + 280ms)
    //   • 600ms → small buffer, then OAuth opens
    window.setTimeout(() => setGoogleClicking(true), 240);
    window.setTimeout(() => {
      void handleGoogle();
    }, 600);
    // Fallback: if OAuth doesn't take over, still auto-close after 5s.
    setCancelCountdown(5);
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          aria-live="polite"
          role="dialog"
          aria-modal="false"
          aria-label="Sign up nudge"
        >
          <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-[2px]" />

          <motion.div
            ref={boxRef}
            animate={{ x: offset.x, y: offset.y, rotate: locked ? [0, -1.5, 1.5, 0] : 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 22, rotate: { duration: 0.4 } }}
            className="relative w-full max-w-sm rounded-3xl border-2 border-white/20 bg-gradient-to-br from-fuchsia-500/90 via-purple-600/90 to-indigo-600/90 p-5 text-white shadow-2xl"
          >
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-none place-items-center rounded-2xl bg-white/15">
                <Sparkles className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="font-fun text-lg font-black leading-tight">Loving the facts?</p>
                <p className="mt-1 text-sm text-white/85">
                  You're on a free trial — sign in to keep your streak, coins &amp; favourites
                  forever.
                </p>
              </div>

              <button
                type="button"
                onMouseEnter={(e) => dodge(e.clientX, e.clientY)}
                onFocus={(e) => {
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  dodge(r.left, r.top);
                }}
                onClick={handleCloseClick}
                aria-label={
                  locked
                    ? `Wait ${remaining}s`
                    : cancelCountdown !== null
                      ? `Closing in ${cancelCountdown}s — click to keep open`
                      : "Close"
                }
                className="ml-auto grid h-9 w-9 flex-none place-items-center rounded-full border border-white/25 bg-white/10 text-white transition hover:bg-white/20"
              >
                {locked ? (
                  <span className="text-sm font-black tabular-nums">{remaining}</span>
                ) : cancelCountdown !== null ? (
                  <span className="text-sm font-black tabular-nums">{cancelCountdown}</span>
                ) : (
                  <X className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Big primary auth button — Apple on Apple devices, Google otherwise. */}
            <motion.button
              ref={googleRef}
              type="button"
              onClick={handleGoogle}
              disabled={googleLoading}
              animate={
                googleClicking
                  ? {
                      scale: [1, 0.9, 1.06, 1],
                      boxShadow: [
                        "0 4px 6px rgba(0,0,0,0.1)",
                        "0 0 0 8px rgba(255,255,255,0.45)",
                        "0 4px 6px rgba(0,0,0,0.1)",
                      ],
                    }
                  : {}
              }
              transition={{ duration: 0.28 }}
              className={
                isApple
                  ? "mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-black px-4 py-3 text-sm font-black text-white shadow hover:scale-[1.02] active:scale-95 transition disabled:opacity-70"
                  : "mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-white px-4 py-3 text-sm font-black text-slate-800 shadow hover:scale-[1.02] active:scale-95 transition disabled:opacity-70"
              }
            >
              {isApple ? (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                  fill="currentColor"
                >
                  <path d="M16.365 1.43c0 1.14-.42 2.23-1.24 3.03-.83.83-2.17 1.47-3.28 1.38-.13-1.1.42-2.24 1.19-3.02.83-.84 2.24-1.47 3.33-1.39zM20.5 17.1c-.56 1.29-.83 1.86-1.55 3-1 1.62-2.42 3.63-4.18 3.65-1.56.02-1.96-1.02-4.08-1.01-2.12.01-2.56 1.03-4.12 1.01-1.76-.03-3.1-1.85-4.1-3.47C.3 16.62-.16 11.6 1.8 8.94c1.4-1.9 3.6-3.02 5.67-3.02 2.11 0 3.44 1.16 5.18 1.16 1.69 0 2.72-1.16 5.16-1.16 1.84 0 3.79 1 5.19 2.73-4.56 2.5-3.82 9.02-.5 8.45z" />
                </svg>
              ) : (
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path
                    fill="#FFC107"
                    d="M43.6 20.5H42V20H24v8h11.3C33.9 32.4 29.4 35.5 24 35.5c-6.4 0-11.5-5.1-11.5-11.5S17.6 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.8 6.3 29.1 4.5 24 4.5 13.2 4.5 4.5 13.2 4.5 24S13.2 43.5 24 43.5 43.5 34.8 43.5 24c0-1.2-.1-2.4-.3-3.5z"
                  />
                  <path
                    fill="#FF3D00"
                    d="M6.3 14.7l6.6 4.8C14.7 15.7 19 12.5 24 12.5c2.9 0 5.6 1.1 7.7 2.9l5.7-5.7C33.8 6.3 29.1 4.5 24 4.5 16.3 4.5 9.7 8.9 6.3 14.7z"
                  />
                  <path
                    fill="#4CAF50"
                    d="M24 43.5c5 0 9.6-1.7 13.2-4.7l-6.1-5c-2 1.4-4.4 2.2-7.1 2.2-5.4 0-9.9-3.5-11.5-8.4l-6.5 5C9.6 39 16.2 43.5 24 43.5z"
                  />
                  <path
                    fill="#1976D2"
                    d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.1 5c-.4.3 6.3-4.6 6.3-14.6 0-1.2-.1-2.4-.3-3.5z"
                  />
                </svg>
              )}
              {googleLoading ? `Opening ${providerLabel}…` : `Sign in with ${providerLabel}`}
            </motion.button>

            <div className="mt-3 flex flex-wrap gap-2">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-xs font-black text-white hover:bg-white/25"
              >
                <UserPlus className="h-3.5 w-3.5" /> Email sign up
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                className="inline-flex items-center rounded-full border border-white/30 bg-white/5 px-3 py-1.5 text-xs font-black text-white hover:bg-white/20"
              >
                Sign in
              </Link>
            </div>

            {locked && (
              <div className="mt-4 flex items-center gap-2 text-xs text-white/80">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <motion.div
                    key={remaining}
                    initial={{ width: `${(remaining / seconds) * 100}%` }}
                    animate={{ width: `${((remaining - 1) / seconds) * 100}%` }}
                    transition={{ duration: 1, ease: "linear" }}
                    className="h-full bg-white/80"
                  />
                </div>
                <span className="tabular-nums font-black">{remaining}s</span>
              </div>
            )}

            {cancelCountdown !== null && !locked && (
              <div className="mt-4 flex items-center justify-between gap-2 rounded-2xl bg-white/10 px-3 py-2 text-xs text-white/90">
                <span>
                  Closing in <span className="tabular-nums font-black">{cancelCountdown}s</span>…
                </span>
                <button
                  type="button"
                  onClick={() => setCancelCountdown(null)}
                  className="rounded-full bg-white/20 px-3 py-1 font-black hover:bg-white/30"
                >
                  Keep open
                </button>
              </div>
            )}
          </motion.div>

          <AnimatePresence>
            {oops && (
              <motion.div
                key={oops.id}
                initial={{ opacity: 0, scale: 0.6, y: 0 }}
                animate={{ opacity: 1, scale: 1, y: -30 }}
                exit={{ opacity: 0, y: -60 }}
                transition={{ duration: 0.8 }}
                style={{ left: oops.x, top: oops.y }}
                className="pointer-events-none fixed -translate-x-1/2 -translate-y-full select-none rounded-full bg-yellow-300 px-3 py-1 text-xs font-black text-purple-900 shadow-lg"
              >
                Oops, you missed! 🙈
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
