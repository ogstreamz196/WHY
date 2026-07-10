import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { getChampionTitle } from "@/lib/chains.functions";
import { avatarEmojiFor } from "@/lib/store";

type Champion = Awaited<ReturnType<typeof getChampionTitle>>;

export function ChampionCrown({ titleKey = "longest_chain", label = "Longest Chain Champion" }: { titleKey?: string; label?: string }) {
  const fetchChampion = useServerFn(getChampionTitle);
  const [c, setC] = useState<Champion | null>(null);

  useEffect(() => {
    let alive = true;
    fetchChampion({ data: { title_key: titleKey } })
      .then((r) => { if (alive) setC(r); })
      .catch(() => {});
    return () => { alive = false; };
  }, [fetchChampion, titleKey]);

  if (!c || !c.holder) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-strong mb-3 flex items-center gap-3 rounded-2xl border border-amber-400/40 bg-gradient-to-r from-amber-500/15 via-yellow-400/10 to-amber-500/15 px-3 py-2.5 shadow-[0_0_30px_-8px_rgba(251,191,36,0.45)]"
      role="status"
      aria-label={`${label}: ${c.holder.display_name ?? "Anonymous"} with ${c.record_value} whys`}
    >
      <motion.div
        animate={{ rotate: [-6, 6, -6] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/30 text-2xl"
      >
        {avatarEmojiFor(c.holder.avatar_id) || "👑"}
      </motion.div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-amber-200/90">
          <Crown className="h-3 w-3" aria-hidden="true" /> {label}
        </div>
        <div className="truncate text-sm font-bold text-white">
          {c.holder.display_name ?? "Anonymous"}
          <span className="ml-2 text-xs font-black text-amber-300">{c.record_value} whys</span>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-white/50">Beat it to claim 👑</div>
    </motion.div>
  );
}
