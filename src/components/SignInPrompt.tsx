import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
};

export function SignInPrompt({ open, onClose, title, message }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="overlay-scroll fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.95 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 220, damping: 22 }}
            onClick={(e) => e.stopPropagation()}
            className="glass-strong relative m-3 w-full max-w-sm rounded-4xl border border-white/10 p-6 shadow-[var(--shadow-card)]"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3 top-3 rounded-full p-2 text-white/60 transition hover:bg-white/10"
            >
              <X className="h-4 w-4" />
            </button>
            <div
              className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full text-3xl shadow-[var(--shadow-glow)]"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h2 className="text-center font-display text-2xl font-black text-white">
              {title ?? "Save your curiosity"}
            </h2>
            <p className="mt-2 text-center text-sm text-white/70">
              {message ??
                "Create a free account to keep your streak, favourites and Y-Coins across all your devices."}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <Link
                to="/auth"
                search={{ mode: "signup" }}
                onClick={onClose}
                className="flex items-center justify-center rounded-full px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)]"
                style={{ background: "var(--gradient-primary)" }}
              >
                Create free account
              </Link>
              <Link
                to="/auth"
                search={{ mode: "signin" }}
                onClick={onClose}
                className="rounded-full border border-white/10 bg-white/5 px-4 py-3 text-center text-sm font-bold text-white/90"
              >
                I already have one
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-center text-xs font-semibold text-white/50 underline-offset-2 hover:underline"
              >
                Keep exploring as guest
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
