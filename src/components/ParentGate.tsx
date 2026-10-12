import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

/**
 * "Ask a grown-up" check shown before any purchase. Apple requires a parental
 * gate in kids' apps, and Google's Families policy expects purchases to be
 * aimed at parents. A multiplication question is hard for young children to
 * guess and quick for adults.
 */
export function ParentGate({
  open,
  onPass,
  onClose,
}: {
  open: boolean;
  onPass: () => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(() => newQuestion());
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (open) {
      setQ(newQuestion());
      setAnswer("");
      setWrong(false);
    }
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(answer.trim()) === q.a * q.b) {
      onPass();
      return;
    }
    setWrong(true);
    setAnswer("");
    setQ(newQuestion());
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/70 p-6 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="parent-gate-title"
          onClick={onClose}
        >
          <motion.form
            onSubmit={submit}
            onClick={(e) => e.stopPropagation()}
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-strong w-full max-w-sm rounded-3xl border border-white/15 p-6 text-center text-white"
          >
            <p className="text-3xl" aria-hidden>
              🧑‍🧒
            </p>
            <h2 id="parent-gate-title" className="mt-2 font-display text-xl font-black">
              Grown-ups only
            </h2>
            <p className="mt-1 text-sm text-white/70">
              Please ask a parent or carer to answer this to continue.
            </p>
            <label className="mt-4 block">
              <span className="text-lg font-black">
                What is {q.a} × {q.b}?
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={answer}
                onChange={(e) => setAnswer(e.target.value.replace(/[^0-9]/g, ""))}
                aria-label="Answer"
                className="mt-2 w-full rounded-2xl border border-white/15 bg-white/5 px-3 py-2.5 text-center text-lg font-black text-white outline-none focus:border-violet-400"
              />
            </label>
            {wrong && (
              <p className="mt-2 text-xs font-bold text-rose-300">Not quite — here's a new one.</p>
            )}
            <button
              type="submit"
              disabled={!answer}
              className="mt-4 w-full rounded-full px-4 py-3 text-sm font-black text-white disabled:opacity-50"
              style={{ background: "var(--gradient-primary)" }}
            >
              Continue
            </button>
            <button
              type="button"
              onClick={onClose}
              className="mt-2 w-full text-xs font-bold text-white/60 underline"
            >
              Cancel
            </button>
          </motion.form>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function newQuestion() {
  const pick = () => 6 + Math.floor(Math.random() * 7); // 6–12
  return { a: pick(), b: pick() };
}
