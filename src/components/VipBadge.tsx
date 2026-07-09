import { motion } from "framer-motion";
import { Crown } from "lucide-react";

type Size = "xs" | "sm" | "md";

const SIZES: Record<Size, { pad: string; text: string; icon: string; gap: string }> = {
  xs: { pad: "px-1.5 py-[1px]", text: "text-[8px]", icon: "h-2.5 w-2.5", gap: "gap-0.5" },
  sm: { pad: "px-2 py-0.5", text: "text-[10px]", icon: "h-3 w-3", gap: "gap-1" },
  md: { pad: "px-2.5 py-1", text: "text-xs", icon: "h-3.5 w-3.5", gap: "gap-1" },
};

/**
 * Special VIP badge shown next to VIP users' names across the app.
 * Uses a shimmering gold gradient with a crown to make VIPs feel special.
 */
export function VipBadge({ size = "sm", className = "" }: { size?: Size; className?: string }) {
  const s = SIZES[size];
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: "spring", stiffness: 380, damping: 22 }}
      className={`inline-flex items-center ${s.gap} ${s.pad} ${s.text} rounded-full font-black uppercase tracking-widest align-middle text-amber-950 border border-amber-300/70 shadow-[0_0_10px_rgba(251,191,36,0.45)] shimmer-gold ${className}`}
      title="VIP member"
      aria-label="VIP member"
    >
      <Crown className={`${s.icon} fill-amber-900/60`} strokeWidth={2.4} />
      VIP
    </motion.span>
  );
}
