import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { toast } from "sonner";
import { setAdultMode } from "@/lib/adult.functions";

/**
 * The 18+ switch. Turning it on shows a content warning first, then opens
 * the 18+ version of Why?; turning it off goes back to the normal app.
 * Render it only when `useAdultStatus().show` is true.
 */
export function AdultModeSwitch({
  on,
  userId,
  size = "md",
}: {
  on: boolean;
  userId: string;
  size?: "sm" | "md";
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const save = useServerFn(setAdultMode);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function change(enabled: boolean) {
    setBusy(true);
    try {
      await save({ data: { enabled, confirm_over_18: enabled } });
      await qc.invalidateQueries({ queryKey: ["adult-status", userId] });
      setConfirming(false);
      await navigate({ to: enabled ? "/adult" : "/home" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't switch modes. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const small = size === "sm";
  return (
    <>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="18+ mode"
        disabled={busy}
        onClick={() => (on ? change(false) : setConfirming(true))}
        className={`relative inline-flex shrink-0 items-center gap-1.5 rounded-full border font-black uppercase tracking-wider transition disabled:opacity-60 ${
          small ? "h-11 px-2.5 text-[10px]" : "h-9 px-3 text-xs"
        } ${
          on
            ? "border-red-500/70 bg-gradient-to-r from-red-600 to-blue-700 text-white shadow-[0_0_18px_rgba(239,68,68,0.45)]"
            : "border-white/15 bg-white/5 text-white/70"
        }`}
      >
        <span
          aria-hidden
          className={`relative h-4 w-7 rounded-full transition ${on ? "bg-white/30" : "bg-white/15"}`}
        >
          <span
            className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${
              on ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
        18+
      </button>

      <AnimatePresence>
        {confirming && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overlay-scroll fixed inset-0 z-[90] flex items-center justify-center bg-black/85 px-4 backdrop-blur-md"
            role="dialog"
            aria-modal="true"
            aria-labelledby="adult-confirm-title"
            onClick={() => !busy && setConfirming(false)}
          >
            <motion.div
              initial={{ scale: 0.9, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 10 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl border border-red-500/40 bg-[#0a0a0f] p-6 text-center shadow-[0_0_60px_rgba(239,68,68,0.25)]"
            >
              <p className="text-5xl" aria-hidden>
                🔞
              </p>
              <h2
                id="adult-confirm-title"
                className="mt-3 font-display text-2xl font-black text-white"
              >
                Adults only past this point
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">
                18+ mode has gross, crude and sweary facts, and a foul-mouthed bot called OG who
                answers your questions. It's not suitable for anyone under 18.
              </p>
              <div className="mt-5 grid gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => change(true)}
                  className="rounded-full bg-gradient-to-r from-red-600 to-blue-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                >
                  {busy ? "Switching…" : "I'm 18 or over. Let's go"}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setConfirming(false)}
                  className="rounded-full bg-white/10 px-4 py-3 text-sm font-black text-white"
                >
                  Take me back
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
