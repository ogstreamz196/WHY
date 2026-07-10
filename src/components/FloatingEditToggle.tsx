import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, Wrench } from "lucide-react";
import { useEditMode } from "@/lib/editMode";

/**
 * Floating "Edit page" widget — bottom-left, boss-only.
 * When toggled on, the heading turns red and the site enters danger edit mode.
 */
export function FloatingEditToggle() {
  const { isBoss, editMode, setEditMode } = useEditMode();
  if (!isBoss) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="fixed bottom-24 left-3 z-[70] select-none pb-[env(safe-area-inset-bottom)]"
    >
      <div
        className={`flex items-center gap-2 rounded-full px-3 py-2 shadow-2xl backdrop-blur-md ${
          editMode
            ? "bg-red-600 text-white ring-2 ring-red-300 shadow-[0_0_25px_rgba(239,68,68,0.65)]"
            : "bg-black/70 text-white/90 ring-1 ring-white/15"
        }`}
      >
        <span className="inline-flex items-center gap-1.5 text-[11px] font-black uppercase tracking-wider">
          {editMode ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 animate-pulse" /> Edit mode
            </>
          ) : (
            <>
              <Wrench className="h-3.5 w-3.5" /> Edit page
            </>
          )}
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={editMode}
          aria-label="Toggle boss edit mode"
          onClick={() => setEditMode(!editMode)}
          className={`relative h-5 w-9 rounded-full transition-colors ${
            editMode ? "bg-white/30" : "bg-white/20"
          }`}
        >
          <motion.span
            layout
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className={`absolute top-0.5 h-4 w-4 rounded-full shadow ${
              editMode ? "left-[18px] bg-white" : "left-0.5 bg-white/80"
            }`}
          />
        </button>
      </div>
      <AnimatePresence>
        {editMode && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-2 max-w-[220px] rounded-xl bg-red-950/85 px-3 py-2 text-[10px] font-semibold leading-tight text-red-100 ring-1 ring-red-400/60"
          >
            Click any text with a dashed outline to rename it. Nav items show ← → arrows to reorder.
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
