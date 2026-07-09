import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { motion, AnimatePresence } from "framer-motion";
import { useMemo, useState } from "react";
import { Sparkles, Flame, Coins, Heart, ArrowRight, Loader2, ChevronDown, Check } from "lucide-react";
import { z } from "zod";
import { CosmicBackground } from "@/components/CosmicBackground";
import { getFavorites, getPoints, getStreak } from "@/lib/store";
import { migrateGuestData } from "@/lib/account.functions";

const searchSchema = z.object({ redirect: z.string().optional() });

export const Route = createFileRoute("/_authenticated/import-guest")({
  head: () => ({
    meta: [
      { title: "Bring your guest progress? — Why?" },
      { name: "description", content: "Import your streak, Y-Coins and favourites into your new account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: searchSchema,
  component: ImportGuestPage,
  errorComponent: ({ error, reset }) => (
    <main className="grid min-h-[100dvh] place-items-center p-6 text-white">
      <div className="glass-strong max-w-md rounded-3xl p-6 text-center">
        <p className="font-bold">Couldn't load your guest data.</p>
        <p className="mt-1 text-sm text-white/60">{error.message}</p>
        <button className="mt-4 rounded-2xl bg-white/10 px-4 py-2 text-sm" onClick={reset}>Try again</button>
      </div>
    </main>
  ),
  notFoundComponent: () => null,
});

function ImportGuestPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const migrate = useServerFn(migrateGuestData);

  const guest = useMemo(() => {
    const favs = getFavorites();
    return {
      points: getPoints(),
      streak: getStreak(),
      favorites: favs,
    };
  }, []);

  const hasAnything = guest.points > 0 || guest.streak > 0 || guest.favorites.length > 0;

  const [showReview, setShowReview] = useState(false);
  const [state, setState] = useState<"idle" | "importing" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const [imported, setImported] = useState(0);

  const goHome = () => navigate({ to: (search.redirect as "/") ?? "/" });

  async function handleImport() {
    setState("importing");
    setError(null);
    try {
      const res = await migrate({
        data: {
          favorite_fact_ids: guest.favorites.map((f) => f.id),
        },
      });
      setImported(res.imported_favorites);
      // Clear local guest snapshot so we don't re-prompt on next sign-in.
      try {
        sessionStorage.removeItem("why:points");
        sessionStorage.removeItem("why:streak");
        sessionStorage.removeItem("why:favorites");
      } catch {
        // ignore
      }
      setState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
      setState("idle");
    }
  }

  if (!hasAnything) {
    // Nothing to bring over — just continue.
    return (
      <main className="grid min-h-[100dvh] place-items-center p-6 text-white">
        <div className="glass-strong max-w-md rounded-3xl p-6 text-center">
          <p className="font-bold">Nothing to import yet.</p>
          <p className="mt-1 text-sm text-white/60">Your new account starts fresh — start exploring!</p>
          <button
            onClick={goHome}
            className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold text-white"
            style={{ background: "var(--gradient-primary)" }}
          >
            Continue <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center px-4 py-10 text-white">
      <CosmicBackground />
      <div className="mx-auto w-full max-w-lg">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-strong rounded-4xl border border-white/10 p-6 shadow-[var(--shadow-card)]"
        >
          <div className="mb-4 flex items-center gap-3">
            <div
              className="flex h-12 w-12 items-center justify-center rounded-2xl"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="font-display text-2xl font-black">Bring your progress?</h1>
              <p className="text-sm text-white/60">We found guest activity on this device.</p>
            </div>
          </div>

          <AnimatePresence>
            {state === "done" ? (
              <motion.div
                key="done"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-3xl border border-emerald-400/30 bg-emerald-400/10 p-4 text-center"
              >
                <Check className="mx-auto mb-2 h-8 w-8 text-emerald-300" />
                <p className="font-bold">Progress imported</p>
                <p className="mt-1 text-sm text-white/70">
                  {guest.points > 0 && <>Y-Coins merged · </>}
                  {guest.streak > 0 && <>Streak preserved · </>}
                  {imported} favourite{imported === 1 ? "" : "s"} added
                </p>
                <button
                  onClick={goHome}
                  className="mt-4 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-sm font-bold"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Continue <ArrowRight className="h-4 w-4" />
                </button>
              </motion.div>
            ) : (
              <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <div className="grid grid-cols-3 gap-2">
                  <SummaryTile icon={<Coins className="h-4 w-4" />} label="Y-Coins" value={guest.points} />
                  <SummaryTile icon={<Flame className="h-4 w-4" />} label="Streak" value={`${guest.streak}d`} />
                  <SummaryTile icon={<Heart className="h-4 w-4" />} label="Favourites" value={guest.favorites.length} />
                </div>

                <button
                  type="button"
                  onClick={() => setShowReview((v) => !v)}
                  className="mt-3 flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-semibold text-white/80 transition hover:bg-white/10"
                >
                  <span>Review what will be brought over</span>
                  <ChevronDown className={`h-4 w-4 transition ${showReview ? "rotate-180" : ""}`} />
                </button>

                <AnimatePresence initial={false}>
                  {showReview && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-3 space-y-2 rounded-2xl border border-white/10 bg-black/20 p-3 text-sm">
                        <ReviewRow label="Y-Coin balance" detail={`${guest.points} coins merged — we keep the higher of guest or account.`} />
                        <ReviewRow label="Streak" detail={`${guest.streak}-day streak preserved as your longest.`} />
                        <ReviewRow
                          label="Favourite facts"
                          detail={`${guest.favorites.length} saved fact${guest.favorites.length === 1 ? "" : "s"} added to your account.`}
                        />
                        {guest.favorites.length > 0 && (
                          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto pr-1 text-xs text-white/70">
                            {guest.favorites.slice(0, 20).map((f) => (
                              <li key={f.id} className="line-clamp-1 rounded-lg bg-white/5 px-2 py-1">
                                • {f.question ?? f.id}
                              </li>
                            ))}
                            {guest.favorites.length > 20 && (
                              <li className="text-white/50">…and {guest.favorites.length - 20} more</li>
                            )}
                          </ul>
                        )}
                        <p className="pt-2 text-[11px] text-white/50">
                          Nothing is overwritten — points and streaks only ever move up.
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {error && (
                  <p className="mt-3 rounded-2xl border border-red-400/30 bg-red-500/10 p-3 text-sm text-red-200">
                    {error}
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-2">
                  <button
                    onClick={handleImport}
                    disabled={state === "importing"}
                    className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {state === "importing" ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Importing…</>
                    ) : (
                      <>Import my progress <ArrowRight className="h-4 w-4" /></>
                    )}
                  </button>
                  <button
                    onClick={goHome}
                    disabled={state === "importing"}
                    className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 transition hover:bg-white/10 disabled:opacity-60"
                  >
                    Skip — start fresh
                  </button>
                  <Link
                    to="/"
                    className="text-center text-xs text-white/40 hover:text-white/70"
                  >
                    Decide later
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </main>
  );
}

function SummaryTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center">
      <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/90">
        {icon}
      </div>
      <div className="mt-1.5 font-display text-lg font-black text-white">{value}</div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-white/50">{label}</div>
    </div>
  );
}

function ReviewRow({ label, detail }: { label: string; detail: string }) {
  return (
    <div className="rounded-xl bg-white/5 p-2.5">
      <div className="text-xs font-bold text-white">{label}</div>
      <div className="mt-0.5 text-xs text-white/60">{detail}</div>
    </div>
  );
}
