import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Cake, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { saveMyBirthDate } from "@/lib/adult.functions";
import { useCurrentUser } from "@/lib/auth";
import { clearPendingBirthDate, takePendingBirthDate } from "@/lib/pendingBirthDate";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
// "Not now" lasts for this visit only (the browser tab), then we ask again.
const SNOOZE_KEY = "why:birthday-prompt-snoozed";
// No interruptions while someone is signing in or deleting their account.
const QUIET_PATHS = ["/auth", "/auth/callback", "/reset-password", "/delete-account", "/privacy"];

/**
 * Asks signed-in players on the website for their birth month and year, once,
 * if their account doesn't have it yet. The wording is neutral (no mention of
 * 18+): the saved birthday keeps Why? right for their age and, for adults,
 * makes the 18+ switch appear. Never shown in the Android/iOS apps, where
 * useAdultStatus doesn't ask the server at all.
 */
export function BirthdayPrompt() {
  const { user } = useCurrentUser();
  const { status, refetch } = useAdultStatus(user?.id);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const save = useServerFn(saveMyBirthDate);
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needed = !!user && !!status && !status.birthdate_known && !QUIET_PATHS.includes(pathname);

  useEffect(() => {
    if (!needed) {
      setOpen(false);
      return;
    }
    // Just signed up with Google/Apple after picking a birthday on the
    // sign-up page: save that instead of asking again.
    const pending = takePendingBirthDate();
    if (pending) {
      clearPendingBirthDate();
      save({ data: pending })
        .then(async (res) => {
          if (res.ok) await refetch();
          else setOpen(true);
        })
        .catch(() => setOpen(true));
      return;
    }
    try {
      if (window.sessionStorage.getItem(SNOOZE_KEY) === "1") return;
    } catch {
      /* private mode: just ask */
    }
    // Wait for the page to settle, and never on top of another pop-up.
    const t = window.setInterval(() => {
      if (!document.querySelector('[aria-modal="true"]')) {
        setOpen(true);
        window.clearInterval(t);
      }
    }, 1500);
    return () => window.clearInterval(t);
    // save/refetch are stable enough; re-running only when `needed` changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed]);

  function notNow() {
    try {
      window.sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!month || !year) return;
    setSaving(true);
    setError(null);
    try {
      const res = await save({ data: { year: Number(year), month: Number(month) } });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const next = await refetch();
      setOpen(false);
      toast.success(
        next.data?.available
          ? "Thanks! Your birthday is saved. 18+ mode is now available in the top bar."
          : "Thanks! Your birthday is saved.",
      );
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const thisYear = new Date().getFullYear();
  const selectCls =
    "w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-3 text-base text-white outline-none focus:border-violet-400";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="birthday-prompt"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="overlay-scroll fixed inset-0 z-[95] flex items-center justify-center bg-black/75 px-4 backdrop-blur-md"
          role="dialog"
          aria-modal="true"
          aria-labelledby="birthday-prompt-title"
        >
          <motion.form
            onSubmit={submit}
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 12 }}
            className="glass-strong w-full max-w-sm rounded-3xl border border-white/15 p-6 text-center shadow-[var(--shadow-card)]"
          >
            <span
              aria-hidden
              className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Cake className="h-7 w-7 text-white" />
            </span>
            <h2
              id="birthday-prompt-title"
              className="mt-3 font-display text-2xl font-black leading-tight text-white"
            >
              When were you born?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-white/80">
              Please be accurate. We use your birth month and year to keep Why? right for your age,
              and you can't change it later.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 text-left">
              <select
                aria-label="Birth month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className={selectCls}
                required
              >
                <option value="">Month</option>
                {MONTHS.map((m, i) => (
                  <option key={m} value={String(i + 1)} className="text-slate-900">
                    {m}
                  </option>
                ))}
              </select>
              <select
                aria-label="Birth year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className={selectCls}
                required
              >
                <option value="">Year</option>
                {Array.from({ length: 100 }, (_, i) => String(thisYear - i)).map((y) => (
                  <option key={y} value={y} className="text-slate-900">
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}

            <button
              type="submit"
              disabled={!month || !year || saving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-black text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save my birthday
            </button>
            <button
              type="button"
              onClick={notNow}
              disabled={saving}
              className="mt-2 w-full rounded-full px-5 py-2.5 text-sm font-bold text-white/70 hover:text-white"
            >
              Not now
            </button>
            <p className="mt-2 text-[11px] text-white/50">
              Only your month and year are saved, never the day.
            </p>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
