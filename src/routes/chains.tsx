import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Heart,
  Loader2,
  Pin,
  PinOff,
  Share2,
  Trash2,
  Link as LinkIcon,
  Sparkles,
} from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useCurrentUser } from "@/lib/auth";
import {
  listMyChains,
  deleteChain,
  setChainShared,
  togglePinChain,
  type ChainSummary,
} from "@/lib/chains.functions";
import {
  listFavorites,
  toggleFavorite as toggleFavoriteServer,
  type FavoriteFact,
} from "@/lib/account.functions";
import { isFavorite, toggleFavorite } from "@/lib/store";
import { emojiFor } from "@/lib/categories";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/chains")({
  head: () => seo({ title: "Your “But why?” chains | Why?", noindex: true }),
  component: ChainsPage,
});

function ChainsPage() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchChains = useServerFn(listMyChains);
  const fetchFavorites = useServerFn(listFavorites);
  const doDelete = useServerFn(deleteChain);
  const doShare = useServerFn(setChainShared);
  const doPin = useServerFn(togglePinChain);
  const doToggleFav = useServerFn(toggleFavoriteServer);

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/auth", search: { mode: "signin", redirect: "/chains" } });
  }, [user, loading, navigate]);

  const chains = useQuery({
    queryKey: ["chains"],
    queryFn: () => fetchChains(),
    enabled: !!user,
  });
  const favorites = useQuery({
    queryKey: ["favorites", user?.id],
    queryFn: () => fetchFavorites(),
    enabled: !!user,
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["chains"] });

  const del = useMutation({
    mutationFn: (id: string) => doDelete({ data: { id } }),
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't delete that. Please try again."),
  });
  const pin = useMutation({
    mutationFn: (v: { id: string; pinned: boolean }) => doPin({ data: v }),
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't pin that. Please try again."),
  });
  const share = useMutation({
    mutationFn: (v: { id: string; is_public: boolean }) => doShare({ data: v }),
    onSuccess: invalidate,
    onError: () => toast.error("Couldn't change sharing. Please try again."),
  });
  const unheart = useMutation({
    mutationFn: (fact: FavoriteFact) => doToggleFav({ data: { fact_id: fact.id } }),
    onSuccess: (_res, fact) => {
      // Home keeps a device copy of hearts too; drop it so the heart there matches.
      if (isFavorite(fact.id)) toggleFavorite({ ...fact, code: "" });
      qc.invalidateQueries({ queryKey: ["favorites"] });
    },
    onError: () => toast.error("Couldn't remove that heart. Please try again."),
  });

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
        <p className="mt-1 text-sm text-white/60">
          The facts you've hearted and trails you've saved.
        </p>

        {/* Hearted facts */}
        <section className="mt-6">
          <h2 className="font-display text-lg font-black text-white">Hearted facts</h2>
          <div className="mt-3 space-y-3">
            {favorites.isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            )}
            {favorites.isError && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                Couldn't load your hearted facts. Please try again in a moment.
              </p>
            )}
            {favorites.data && favorites.data.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                No hearted facts yet. Tap the heart on any fact to keep it here.
              </p>
            )}
            {(favorites.data ?? []).map((f) => (
              <FavoriteRow
                key={f.id}
                fact={f}
                removing={unheart.isPending && unheart.variables?.id === f.id}
                onRemove={() => unheart.mutate(f)}
              />
            ))}
          </div>
        </section>

        {/* Chains */}
        <section className="mt-8">
          <h2 className="font-display text-lg font-black text-white">Saved trails</h2>
          <div className="mt-3 space-y-3">
            {chains.isLoading && (
              <div className="flex justify-center py-6">
                <Loader2 className="h-6 w-6 animate-spin text-white/60" />
              </div>
            )}
            {chains.data && chains.data.items.length === 0 && (
              <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-white/60">
                Nothing saved yet. Tap <span className="font-bold text-white">But… Why?</span> on a
                fact, then <span className="font-bold text-white">Save to favourites</span> to keep
                the trail.
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

function FavoriteRow({
  fact,
  removing,
  onRemove,
}: {
  fact: FavoriteFact;
  removing: boolean;
  onRemove: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-3xl border border-white/10 p-4"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-widest text-amber-200/80">
            {emojiFor(fact.category)} Do you know why…
          </div>
          <div className="mt-1 font-display font-black leading-tight text-white">
            {fact.question}
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-white/70">{fact.answer}</p>
          {fact.fun_fact && <p className="mt-1.5 text-xs text-amber-200/80">⭐ {fact.fun_fact}</p>}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={removing}
          className="shrink-0 rounded-full bg-rose-500/15 p-2 text-rose-200 disabled:opacity-50"
          aria-label="Remove heart"
        >
          {removing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Heart className="h-4 w-4 fill-current" />
          )}
        </button>
      </div>
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
  const shareUrl =
    chain.share_slug && typeof window !== "undefined"
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
            <div className="font-display font-black leading-tight text-white">
              {chain.title ?? "Untitled favourite"}
            </div>
            {chain.last_question && (
              <div className="mt-0.5 line-clamp-2 text-xs text-white/60">
                → {chain.last_question}
              </div>
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
                if (navigator.share)
                  await navigator.share({ url: shareUrl, title: chain.title ?? "Why chain" });
                else {
                  await navigator.clipboard.writeText(shareUrl);
                  alert("Link copied!");
                }
              } catch {
                /* cancelled */
              }
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
