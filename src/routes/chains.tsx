import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  FolderPlus,
  Loader2,
  Pin,
  PinOff,
  Share2,
  Trash2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useCurrentUser } from "@/lib/auth";
import {
  listMyChains,
  deleteChain,
  setChainShared,
  togglePinChain,
  listCollections,
  createCollection,
  type ChainSummary,
  type CollectionSummary,
} from "@/lib/chains.functions";

export const Route = createFileRoute("/chains")({
  head: () => ({
    meta: [{ title: "Your Favourites — Why?" }],
  }),
  component: ChainsPage,
});

function ChainsPage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchChains = useServerFn(listMyChains);
  const fetchCollections = useServerFn(listCollections);
  const doDelete = useServerFn(deleteChain);
  const doShare = useServerFn(setChainShared);
  const doPin = useServerFn(togglePinChain);
  const doCreate = useServerFn(createCollection);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", search: { mode: "signin", redirect: "/chains" } });
  }, [user, loading, navigate]);

  const chains = useQuery({
    queryKey: ["chains"],
    queryFn: () => fetchChains(),
    enabled: !!user,
  });
  const collections = useQuery({
    queryKey: ["collections"],
    queryFn: () => fetchCollections(),
    enabled: !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chains"] });
  const invalidateCollections = () => qc.invalidateQueries({ queryKey: ["collections"] });

  const del = useMutation({ mutationFn: (id: string) => doDelete({ data: { id } }), onSuccess: invalidate });
  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => doPin({ data: v }),
    onSuccess: invalidate,
  });
  const share = useMutation({
    mutationFn: (v: { id: string; is_public: boolean }) => doShare({ data: v }),
    onSuccess: invalidate,
  });
  const createCol = useMutation({
    mutationFn: (name: string) => doCreate({ data: { name } }),
    onSuccess: invalidateCollections,
  });

  const [newCol, setNewCol] = useState("");
  const [showNewCol, setShowNewCol] = useState(false);

  if (loading || !user) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <h1 className="font-display text-3xl font-black text-white">Your Favourites</h1>
        <p className="mt-1 text-sm text-white/60">The curiosity trails you've saved.</p>

        {/* Collections */}
        <section className="mt-6">
          <header className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-lg font-black text-white">Collections</h2>
            <button
              type="button"
              onClick={() => setShowNewCol((v) => !v)}
              className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/80"
            >
              <FolderPlus className="h-4 w-4" /> New
            </button>
          </header>
          <AnimatePresence>
            {showNewCol && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mb-3 flex gap-2">
                  <input
                    autoFocus
                    value={newCol}
                    onChange={(e) => setNewCol(e.target.value)}
                    placeholder="e.g. Space mysteries"
                    maxLength={80}
                    className="flex-1 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white outline-none placeholder:text-white/40"
                  />
                  <button
                    type="button"
                    onClick={async () => {
                      const name = newCol.trim();
                      if (!name) return;
                      await createCol.mutateAsync(name);
                      setNewCol("");
                      setShowNewCol(false);
                    }}
                    className="rounded-full px-4 py-2 text-sm font-bold text-white"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    Add
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          {collections.data && collections.data.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {collections.data.map((c) => (
                <CollectionCard key={c.id} c={c} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
              No collections yet — group related favourites into a theme.
            </p>
          )}
        </section>

        {/* Chains */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-black text-white">Saved Favourites</h2>
          <div className="mt-3 space-y-3">
            {chains.isLoading && (
              <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-white/60" /></div>
            )}
            {chains.data && chains.data.items.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                Nothing saved yet. Tap <span className="font-bold text-white">But… Why?</span> on a fact,
                then <span className="font-bold text-white">Save to favourites</span> to keep the trail.
              </p>
            )}
            {(chains.data?.items ?? []).map((chain) => (
              <ChainRow
                key={chain.id}
                chain={chain}
                onOpen={() => navigate({ to: "/chain/$id", params: { id: chain.id } })}
                onDelete={() => {
                  if (confirm("Delete this from favourites?")) del.mutate(chain.id);
                }}
                onPin={() => pin.mutate({ id: chain.id, pinned: !chain.pinned })}
                onShare={() => share.mutate({ id: chain.id, is_public: !chain.is_public })}
              />
            ))}
          </div>
        </section>
      </div>
      <BottomNav />
    </main>
  );
}

function CollectionCard({ c }: { c: CollectionSummary }) {
  return (
    <motion.div whileHover={{ scale: 1.02 }} className="glass rounded-3xl border border-white/10 p-4">
      <div className="text-2xl">📚</div>
      <div className="mt-1 font-black text-white">{c.name}</div>
      <div className="text-[11px] text-white/50">{c.chain_count} item{c.chain_count === 1 ? "" : "s"}</div>
    </motion.div>
  );
}

function ChainRow({
  chain,
  onOpen,
  onDelete,
  onPin,
  onShare,
}: {
  chain: ChainSummary;
  onOpen: () => void;
  onDelete: () => void;
  onPin: () => void;
  onShare: () => void;
}) {
  const shareUrl = chain.share_slug && typeof window !== "undefined"
    ? `${window.location.origin}/c/${chain.share_slug}`
    : null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl border border-white/10 p-4"
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start gap-2">
          <Sparkles className="mt-1 h-4 w-4 text-fuchsia-300" />
          <div className="flex-1">
            <div className="font-display font-black leading-tight text-white">{chain.title ?? "Untitled favourite"}</div>
            {chain.last_question && (
              <div className="mt-0.5 line-clamp-2 text-xs text-white/60">→ {chain.last_question}</div>
            )}
            <div className="mt-1 text-[10px] font-bold uppercase tracking-widest text-white/40">
              {chain.step_count} step{chain.step_count === 1 ? "" : "s"}
            </div>
          </div>
          <ArrowRight className="mt-1 h-4 w-4 text-white/50" />
        </div>
      </button>
      <div className="mt-3 flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPin}
          className={`rounded-full p-2 ${chain.pinned ? "bg-amber-400/20 text-amber-200" : "bg-white/5 text-white/60"}`}
          aria-label={chain.pinned ? "Unpin" : "Pin"}
        >
          {chain.pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onShare}
          className={`rounded-full p-2 ${chain.is_public ? "bg-cyan-400/20 text-cyan-200" : "bg-white/5 text-white/60"}`}
          aria-label={chain.is_public ? "Make private" : "Share publicly"}
        >
          <Share2 className="h-4 w-4" />
        </button>
        {shareUrl && chain.is_public && (
          <button
            type="button"
            onClick={async () => {
              try {
                if (navigator.share) await navigator.share({ url: shareUrl, title: chain.title ?? "Why chain" });
                else { await navigator.clipboard.writeText(shareUrl); alert("Link copied!"); }
              } catch { /* cancelled */ }
            }}
            className="inline-flex items-center gap-1 rounded-full bg-cyan-400/10 px-3 py-1.5 text-[11px] font-bold text-cyan-200"
          >
            <LinkIcon className="h-3.5 w-3.5" /> Copy link
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onDelete}
          className="rounded-full bg-rose-500/10 p-2 text-rose-200"
          aria-label="Delete"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  );
}
