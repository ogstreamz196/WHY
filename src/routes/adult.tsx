import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2, MessageCircle, RefreshCw, Send, Sparkles } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { AdultModeSwitch } from "@/components/AdultModeSwitch";
import { useAdultStatus } from "@/hooks/useAdultStatus";
import { useCurrentUser } from "@/lib/auth";
import { useIsNativeApp } from "@/lib/platform";
import { adultWhyLayer, askOg, nextAdultFact, type AdultFact } from "@/lib/adult.functions";
import { seo } from "@/lib/site";

export const Route = createFileRoute("/adult")({
  head: () => seo({ title: "Why? 18+", noindex: true, themeColor: "#040406" }),
  component: AdultPage,
});

const MAX_WHY_DEPTH = 5;
const SEEN_KEY = "why18:seen";

function readSeen(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(v) ? v.slice(-300) : [];
  } catch {
    return [];
  }
}
function rememberSeen(id: string) {
  try {
    const next = [...readSeen().filter((x) => x !== id), id].slice(-300);
    localStorage.setItem(SEEN_KEY, JSON.stringify(next));
  } catch {
    /* private mode: fine */
  }
}

// 18+ mode is website only. Inside the Android/iOS apps this page shows
// nothing adult at all (and the server refuses every 18+ request from them).
function AdultPage() {
  const isNative = useIsNativeApp();
  if (isNative === null) return <main className="min-h-[100dvh] bg-[#040406]" />;
  if (isNative) {
    return (
      <main className="grid min-h-[100dvh] place-items-center p-6 text-center text-white">
        <div className="max-w-sm">
          <h1 className="font-display text-2xl font-black">Page not found</h1>
          <Link to="/" className="mt-6 inline-block rounded-full bg-white/10 px-5 py-2 font-bold">
            Back to facts
          </Link>
        </div>
      </main>
    );
  }
  return <AdultGate />;
}

function AdultGate() {
  const { user, loading } = useCurrentUser();
  const navigate = useNavigate();
  const { status, show } = useAdultStatus(user?.id);

  useEffect(() => {
    if (!loading && !user)
      navigate({ to: "/auth", search: { mode: "signin", redirect: "/adult" } });
  }, [user, loading, navigate]);

  if (loading || !user || !status) {
    return (
      <main className="adult-theme grid min-h-[100dvh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </main>
    );
  }

  if (!show) {
    return (
      <main className="adult-theme grid min-h-[100dvh] place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-display text-2xl font-black text-white">
            This area isn't available for your account
          </h1>
          <Link to="/" className="mt-6 inline-block rounded-full bg-white/10 px-5 py-2 font-bold">
            Back to facts
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="adult-theme relative min-h-[100dvh] w-full pb-16">
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 md:max-w-3xl">
        <header className="mb-4 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-baseline gap-2" aria-label="Why? home">
            <span className="adult-silver-text font-display text-3xl font-black tracking-tight">
              WHY?
            </span>
            <span className="rounded-md bg-red-600 px-1.5 py-0.5 text-[11px] font-black text-white">
              18+
            </span>
          </Link>
          <AdultModeSwitch on={status.mode_enabled} userId={user.id} />
        </header>

        {status.mode_enabled ? (
          <>
            <AdultFactCard />
            <AskWhy />
            <p className="mt-8 text-center text-[11px] leading-relaxed text-slate-500">
              Adults only. The facts are real; the language isn't polite. Nothing here earns coins
              or counts on the leaderboards. Switch 18+ off any time to go back to normal Why?.
            </p>
          </>
        ) : (
          <section className="adult-card mt-6 rounded-3xl p-6 text-center">
            <p className="text-5xl" aria-hidden>
              🔞
            </p>
            <h1 className="adult-silver-text mt-3 font-display text-3xl font-black">
              Why? after dark
            </h1>
            <p className="mt-2 text-sm text-slate-300">
              Gross, weird and filthy-funny facts, plus OG, a foul-mouthed bot who'll answer
              anything you ask. Flip the 18+ switch to come in.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}

// -------------------- Fact card: same idea as the home page --------------------

function AdultFactCard() {
  const getNext = useServerFn(nextAdultFact);
  const getLayer = useServerFn(adultWhyLayer);
  const [fact, setFact] = useState<AdultFact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [layers, setLayers] = useState<string[]>([]);
  const [digging, setDigging] = useState(false);

  const load = useCallback(
    async (fresh = false) => {
      setLoading(true);
      setError(null);
      setRevealed(false);
      setLayers([]);
      try {
        const f = await getNext({ data: { seen: readSeen(), fresh } });
        setFact(f);
        if (f) rememberSeen(f.id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Couldn't load a fact.");
      } finally {
        setLoading(false);
      }
    },
    [getNext],
  );

  useEffect(() => {
    void load();
  }, [load]);

  async function digDeeper() {
    if (!fact || digging || layers.length >= MAX_WHY_DEPTH) return;
    setDigging(true);
    setError(null);
    try {
      const { answer } = await getLayer({
        data: { question: fact.question, chain: [fact.answer, ...layers] },
      });
      setLayers((l) => [...l, answer]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't dig deeper.");
    } finally {
      setDigging(false);
    }
  }

  return (
    <section aria-label="18+ fact">
      <AnimatePresence mode="wait">
        <motion.article
          key={fact?.id ?? (loading ? "loading" : "empty")}
          initial={{ opacity: 0, y: 16, rotate: -0.5 }}
          animate={{ opacity: 1, y: 0, rotate: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="adult-card relative overflow-hidden rounded-3xl p-5 sm:p-7"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-red-600/25 blur-3xl"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-24 -left-16 h-56 w-56 rounded-full bg-blue-600/25 blur-3xl"
          />
          {loading ? (
            <div className="space-y-3 py-6" aria-busy="true">
              <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
              <div className="h-8 w-full animate-pulse rounded bg-white/10" />
              <div className="h-8 w-2/3 animate-pulse rounded bg-white/10" />
              <p className="pt-2 text-sm text-slate-400">Digging up something disgusting…</p>
            </div>
          ) : !fact ? (
            <p className="py-6 text-slate-300">
              {error ?? "Nothing filthy enough yet. Try again."}
            </p>
          ) : (
            <div className="relative">
              <span className="inline-flex rounded-full border border-red-500/50 bg-red-600/15 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-red-200">
                {fact.category ?? "18+"}
              </span>
              <h2 className="mt-3 font-display text-[clamp(1.5rem,4.5vw,2.2rem)] font-black leading-tight text-white">
                Do you know why {fact.question}?
              </h2>

              {!revealed ? (
                <motion.button
                  type="button"
                  onClick={() => setRevealed(true)}
                  whileTap={{ scale: 0.97 }}
                  className="adult-button mt-5 w-full rounded-full px-5 py-3.5 text-sm font-black uppercase tracking-wider shadow-[0_0_30px_rgba(239,35,60,0.35)]"
                >
                  Tell me, you filthy animal
                </motion.button>
              ) : (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <p className="mt-4 text-[clamp(1rem,2.6vw,1.15rem)] leading-relaxed text-slate-100">
                    {fact.answer}
                  </p>
                  {fact.fun_fact && (
                    <p className="mt-3 rounded-2xl border border-blue-500/30 bg-blue-600/10 p-3 text-sm text-blue-100">
                      <span className="mr-1 font-black text-blue-300">Bonus grossness:</span>
                      {fact.fun_fact}
                    </p>
                  )}

                  {layers.map((l, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="mt-3 border-l-2 border-red-500/70 pl-3"
                    >
                      <p className="text-[10px] font-black uppercase tracking-widest text-red-300">
                        But… why? · level {i + 2}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-slate-100">{l}</p>
                    </motion.div>
                  ))}

                  {layers.length < MAX_WHY_DEPTH ? (
                    <button
                      type="button"
                      onClick={digDeeper}
                      disabled={digging}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-300/30 bg-white/5 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
                    >
                      {digging ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 text-red-300" />
                      )}
                      But… why?
                    </button>
                  ) : (
                    <p className="mt-4 text-center text-xs font-bold text-slate-400">
                      That's rock bottom. Nobody knows anything deeper. Probably.
                    </p>
                  )}
                </motion.div>
              )}
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </div>
          )}
        </motion.article>
      </AnimatePresence>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => load(false)}
          disabled={loading}
          className="adult-button rounded-full px-4 py-3 text-sm font-black disabled:opacity-60"
        >
          Next fact
        </button>
        <button
          type="button"
          onClick={() => load(true)}
          disabled={loading}
          className="inline-flex items-center justify-center gap-1.5 rounded-full border border-slate-300/30 bg-white/5 px-4 py-3 text-sm font-black text-slate-100 disabled:opacity-60"
        >
          <RefreshCw className="h-4 w-4" /> Cook a fresh one
        </button>
      </div>
    </section>
  );
}

// -------------------- Ask Why? — chat with OG --------------------

type ChatLine = { role: "user" | "og"; text: string };

function AskWhy() {
  const ask = useServerFn(askOg);
  const [lines, setLines] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [lines, sending]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const question = draft.trim();
    if (question.length < 2 || sending) return;
    const history = lines.slice(-12);
    setLines((l) => [...l, { role: "user", text: question }]);
    setDraft("");
    setSending(true);
    setError(null);
    try {
      const { reply } = await ask({ data: { question, history } });
      setLines((l) => [...l, { role: "og", text: reply }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "OG didn't answer. Try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="adult-card mt-6 rounded-3xl p-5" aria-labelledby="ask-why-title">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-blue-700 text-xl">
          🤬
        </span>
        <div>
          <h2 id="ask-why-title" className="adult-silver-text font-display text-2xl font-black">
            Ask Why?
          </h2>
          <p className="text-xs text-slate-400">
            Ask OG anything. Expect the truth, and a mouthful.
          </p>
        </div>
      </div>

      <div className="mt-4 max-h-[26rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
        {lines.length === 0 && (
          <div className="flex flex-wrap gap-2">
            {[
              "Why do farts smell worse in the shower?",
              "Why is earwax a thing?",
              "Why do hangovers feel like death?",
            ].map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setDraft(q)}
                className="rounded-full border border-slate-300/20 bg-white/5 px-3 py-1.5 text-xs font-bold text-slate-200"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {lines.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${l.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                l.role === "user"
                  ? "rounded-br-sm bg-blue-600 text-white"
                  : "rounded-bl-sm border border-red-500/30 bg-red-950/40 text-slate-100"
              }`}
            >
              {l.role === "og" && (
                <span className="mb-0.5 block text-[10px] font-black uppercase tracking-widest text-red-300">
                  OG
                </span>
              )}
              {l.text}
            </p>
          </motion.div>
        ))}
        {sending && (
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <MessageCircle className="h-4 w-4 animate-pulse text-red-300" /> OG is typing something
            rude…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && <p className="mt-2 text-sm text-red-300">{error}</p>}

      <form onSubmit={send} className="mt-4 flex items-center gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={500}
          placeholder="Ask OG why…"
          aria-label="Your question for OG"
          className="min-w-0 flex-1 rounded-full border border-slate-300/20 bg-black/40 px-4 py-3 text-base text-white placeholder-slate-500 outline-none focus:border-red-500/60"
        />
        <button
          type="submit"
          disabled={sending || draft.trim().length < 2}
          aria-label="Send"
          className="adult-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full disabled:opacity-50"
        >
          {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
        </button>
      </form>
      <p className="mt-2 text-[10px] text-slate-500">
        Questions go to OG and our AI providers to be answered. We don't keep your chat.
      </p>
    </section>
  );
}
