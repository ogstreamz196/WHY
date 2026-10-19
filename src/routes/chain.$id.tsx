import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Copy,
  Globe,
  Loader2,
  Lock,
  RefreshCw,
  Share2,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BottomNav } from "@/components/BottomNav";
import { CosmicBackground } from "@/components/CosmicBackground";
import { useCurrentUser } from "@/lib/auth";
import { getChain, regenerateChainSlug, setChainShared } from "@/lib/chains.functions";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/chain/$id")({
  head: () => seo({ title: "“But why?” chain | Why?", noindex: true }),
  component: ChainDetailPage,
});

function ChainDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, loading } = useCurrentUser();

  const fetchChain = useServerFn(getChain);
  const doShare = useServerFn(setChainShared);
  const doRegen = useServerFn(regenerateChainSlug);

  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/auth", search: { mode: "signin", redirect: `/chain/${id}` } });
  }, [user, loading, navigate, id]);

  const chain = useQuery({
    queryKey: ["chain", id],
    queryFn: () => fetchChain({ data: { id } }),
    enabled: !!user,
  });

  const share = useMutation({
    mutationFn: (is_public: boolean) => doShare({ data: { id, is_public } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["chain", id] });
      // The list page shows the shared state too.
      qc.invalidateQueries({ queryKey: ["chains"] });
    },
    onError: () => toast.error("Couldn't change sharing. Please try again."),
  });

  const regen = useMutation({
    mutationFn: () => doRegen({ data: { id } }),
    onSuccess: () => {
      setCopied(false);
      qc.invalidateQueries({ queryKey: ["chain", id] });
      qc.invalidateQueries({ queryKey: ["chains"] });
    },
    onError: () => toast.error("Couldn't make a new link. Please try again."),
  });

  if (loading || chain.isLoading) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }
  if (!chain.data) {
    return (
      <main className="flex min-h-[100dvh] items-center justify-center px-6 text-center text-white/80">
        <div>
          <p className="font-display text-xl font-black">Chain not found.</p>
          <Link
            to="/chains"
            className="mt-4 inline-block rounded-full bg-white/10 px-4 py-2 text-sm font-bold"
          >
            Back to chains
          </Link>
        </div>
      </main>
    );
  }

  const c = chain.data;
  const shareUrl =
    c.share_slug && typeof window !== "undefined"
      ? `${window.location.origin}/c/${c.share_slug}`
      : null;

  async function copy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  async function nativeShare() {
    if (!shareUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: c.title ?? "A Why chain", url: shareUrl });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  }

  return (
    <main className="relative min-h-[100dvh] w-full pb-32">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6">
        <Link
          to="/chains"
          className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold text-white/80"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> All chains
        </Link>

        <motion.article
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong mt-4 overflow-hidden rounded-4xl p-6"
        >
          <h1 className="font-display text-2xl font-black leading-tight text-white sm:text-3xl">
            {c.title ?? "Untitled chain"}
          </h1>
          <p className="mt-1 text-xs text-white/50">
            {c.steps.length} step{c.steps.length === 1 ? "" : "s"}
          </p>

          {/* Share controls */}
          <div className="glass mt-5 rounded-3xl border border-white/10 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl ${
                    c.is_public ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/60"
                  }`}
                >
                  {c.is_public ? <Globe className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
                </div>
                <div>
                  <div className="text-sm font-black text-white">
                    {c.is_public ? "Public — anyone with the link" : "Private to you"}
                  </div>
                  <div className="text-[10px] text-white/50">
                    {c.is_public
                      ? "Revoke to instantly break the link."
                      : "Turn on sharing to generate a link."}
                  </div>
                </div>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={c.is_public}
                onClick={() => share.mutate(!c.is_public)}
                disabled={share.isPending}
                className={`relative h-6 w-11 rounded-full transition ${
                  c.is_public ? "bg-emerald-400" : "bg-white/20"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    c.is_public ? "translate-x-5" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            <AnimatePresence>
              {c.is_public && shareUrl && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-black/30 px-3 py-2">
                    <span className="truncate text-[11px] text-white/70">{shareUrl}</span>
                    <button
                      type="button"
                      onClick={copy}
                      className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white"
                    >
                      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={nativeShare}
                      className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black text-white"
                      style={{ background: "var(--gradient-primary)" }}
                    >
                      <Share2 className="h-3.5 w-3.5" /> Share
                    </button>
                    <button
                      type="button"
                      onClick={() => regen.mutate()}
                      disabled={regen.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-bold text-white/80"
                    >
                      {regen.isPending ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="h-3.5 w-3.5" />
                      )}
                      New link
                    </button>
                    <button
                      type="button"
                      onClick={() => share.mutate(false)}
                      disabled={share.isPending}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-400/30 bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-200"
                    >
                      <Lock className="h-3.5 w-3.5" /> Revoke
                    </button>
                  </div>
                  <p className="mt-2 text-[10px] text-white/40">
                    Generating a new link stops the old one from working.
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ol className="relative mt-6 space-y-4 pl-9">
            <span
              aria-hidden
              className="absolute left-3.5 top-3 bottom-3 w-0.5 rounded-full bg-gradient-to-b from-fuchsia-500/60 via-violet-500/40 to-transparent"
            />
            {c.steps.map((s, i) => (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="relative"
              >
                <span
                  className="absolute -left-9 top-0.5 flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black text-white shadow-lg"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  {i + 1}
                </span>
                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                  <p className="text-sm font-bold leading-snug text-white">{s.question}</p>
                  {s.answer && (
                    <p className="mt-1.5 text-xs leading-relaxed text-white/70">{s.answer}</p>
                  )}
                </div>
              </motion.li>
            ))}
          </ol>

          <Link
            to="/"
            className="mt-6 flex items-center justify-center gap-2 rounded-full px-5 py-4 text-base font-black text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-5 w-5" />
            Keep exploring
          </Link>
        </motion.article>
      </div>
      <BottomNav />
    </main>
  );
}
