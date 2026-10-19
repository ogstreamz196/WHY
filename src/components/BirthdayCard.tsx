import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Cake, Loader2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { saveMyBirthDate } from "@/lib/adult.functions";
import { clearPendingBirthDate, takePendingBirthDate } from "@/lib/pendingBirthDate";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "Later" hides the card for this visit (the browser tab) only.
const SNOOZE_KEY = "why:birthday-card-snoozed";

/**
 * "Add your birthday" card at the top of the home page, for signed-in players
 * on the website whose account has no birth month/year yet. A card, not a
 * pop-up, so it never gets in the way. Neutral wording (no mention of 18+);
 * for adults, saving makes the 18+ switch appear. Never shown in the
 * Android/iOS apps, where useAdultStatus doesn't ask the server at all.
 *
 * It also finishes Google/Apple sign-ups: the birthday picked on the sign-up
 * page is saved here automatically instead of asking again.
 */
export function BirthdayCard({ userId }: { userId: string | null }) {
  const { status, refetch } = useAdultStatus(userId);
  const save = useServerFn(saveMyBirthDate);
  const [month, setMonth] = useState("");
  const [year, setYear] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [snoozed, setSnoozed] = useState(true);
  const [autoSaving, setAutoSaving] = useState(false);

  const missing = !!userId && !!status && !status.birthdate_known;

  useEffect(() => {
    if (!missing) return;
    const pending = takePendingBirthDate();
    if (pending) {
      clearPendingBirthDate();
      setAutoSaving(true);
      save({ data: pending })
        .then(async (res) => {
          if (res.ok) await refetch();
        })
        .catch(() => {})
        .finally(() => setAutoSaving(false));
    }
    try {
      setSnoozed(window.sessionStorage.getItem(SNOOZE_KEY) === "1");
    } catch {
      setSnoozed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missing]);

  function later() {
    try {
      window.sessionStorage.setItem(SNOOZE_KEY, "1");
    } catch {
      /* ignore */
    }
    setSnoozed(true);
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
      toast.success(
        next.data?.available
          ? "Birthday saved! 18+ mode is now available in the top bar."
          : "Birthday saved. Thanks!",
      );
    } catch {
      setError("Couldn't save that. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  const show = missing && !snoozed && !autoSaving;
  const thisYear = new Date().getFullYear();
  const selectCls =
    "min-w-0 flex-1 rounded-xl border border-white/15 bg-black/30 px-2.5 py-2 text-sm font-bold text-white outline-none focus:border-violet-400";

  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.form
          key="birthday-card"
          onSubmit={submit}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="relative overflow-hidden rounded-2xl border border-violet-300/30 bg-gradient-to-r from-violet-600/25 via-fuchsia-600/15 to-amber-500/15 p-3"
          aria-labelledby="birthday-card-title"
        >
          <button
            type="button"
            onClick={later}
            aria-label="Later"
            className="absolute right-1.5 top-1.5 rounded-full p-1.5 text-white/60 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2 pr-7">
            <span
              aria-hidden
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Cake className="h-4 w-4 text-white" />
            </span>
            <div className="min-w-0">
              <p id="birthday-card-title" className="text-sm font-black text-white">
                Add your birthday
              </p>
              <p className="text-[11px] leading-snug text-white/70">
                Please be accurate: it keeps Why? right for your age and can't be changed later.
              </p>
            </div>
          </div>
          <div className="mt-2.5 flex max-w-xl items-center gap-2">
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
            <button
              type="submit"
              disabled={!month || !year || saving}
              className="flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-black text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Save
            </button>
          </div>
          {error && <p className="mt-2 text-xs font-bold text-rose-300">{error}</p>}
        </motion.form>
      )}
    </AnimatePresence>
  );
}
