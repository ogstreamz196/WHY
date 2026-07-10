import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Check, Loader2, Sparkles, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import { CosmicBackground } from "@/components/CosmicBackground";
import { Celebration } from "@/components/Celebration";
import { AnswerSummary } from "@/components/AnswerSummary";
import { FeedbackToggles } from "@/components/FeedbackToggles";
import { feedback } from "@/lib/feedback";
import {
  finishQuiz,
  submitAnswer,
  type AnswerResult,
  type FinishResult,
  type QuizStartResult,
} from "@/lib/quiz.functions";
import { emojiFor } from "@/lib/categories";
import { asWhyQuestion } from "@/lib/whyQuestion";

export const Route = createFileRoute("/_authenticated/quiz/$sessionId")({
  component: QuizPlayPage,
});

const TIMER_MS: Record<string, number> = {
  easy: 15000,
  medium: 12000,
  hard: 10000,
  expert: 8000,
};

function QuizPlayPage() {
  const { sessionId } = Route.useParams();
  const navigate = useNavigate();
  const submit = useServerFn(submitAnswer);
  const finish = useServerFn(finishQuiz);

  const [quiz, setQuiz] = useState<QuizStartResult | null>(null);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [answering, setAnswering] = useState(false);
  const [finalResult, setFinalResult] = useState<FinishResult | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [totalPoints, setTotalPoints] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const startedAtRef = useRef<number>(Date.now());
  const [timeLeft, setTimeLeft] = useState<number>(0);
  const revealBtnRef = useRef<HTMLButtonElement | null>(null);
  const firstChoiceRef = useRef<HTMLButtonElement | null>(null);


  useEffect(() => {
    const raw = sessionStorage.getItem(`quiz:${sessionId}`);
    if (!raw) {
      toast.error("Quiz session expired — start a new one.");
      navigate({ to: "/quiz" });
      return;
    }
    setQuiz(JSON.parse(raw) as QuizStartResult);
  }, [sessionId, navigate]);

  const current = quiz?.questions[idx];
  const totalMs = current ? TIMER_MS[current.difficulty] ?? 12000 : 0;

  // Timer only runs after user reveals the answers.
  useEffect(() => {
    if (!current || result || !revealed) return;
    startedAtRef.current = Date.now();
    setTimeLeft(totalMs);
    const t = setInterval(() => {
      const left = totalMs - (Date.now() - startedAtRef.current);
      setTimeLeft(left);
      if (left <= 0) {
        clearInterval(t);
        void handlePick(-1);
      }
    }, 100);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, quiz, revealed]);

  // Focus management: reveal button on new question, first choice on reveal.
  useEffect(() => {
    if (!current || result) return;
    if (!revealed) revealBtnRef.current?.focus();
    else firstChoiceRef.current?.focus();
  }, [idx, revealed, current, result]);


  async function handlePick(pickIndex: number) {
    if (!current || answering || result) return;
    setAnswering(true);
    setPicked(pickIndex);
    try {
      const msTaken = Date.now() - startedAtRef.current;
      const res = await submit({
        data: {
          session_id: sessionId,
          fact_id: current.fact_id,
          picked_index: pickIndex < 0 ? 0 : pickIndex,
          ms_taken: msTaken,
        },
      });
      // Force wrong when timed out even if index 0 happens to match
      if (pickIndex < 0) {
        setResult({ ...res, correct: false, points_awarded: 0 });
      } else {
        setResult(res);
      }
      setTotalPoints((p) => p + (pickIndex < 0 ? 0 : res.points_awarded));
      if (pickIndex >= 0 && res.correct && typeof navigator !== "undefined" && "vibrate" in navigator) {
        navigator.vibrate?.(40);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Answer failed");
    } finally {
      setAnswering(false);
    }
  }

  async function next() {
    if (!quiz) return;
    if (idx + 1 >= quiz.questions.length) {
      try {
        const f = await finish({ data: { session_id: sessionId } });
        setFinalResult(f);
        sessionStorage.removeItem(`quiz:${sessionId}`);
        setCelebrate(true);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not finish quiz");
      }
      return;
    }
    setIdx((i) => i + 1);
    setPicked(null);
    setResult(null);
    setRevealed(false);
  }

  if (!quiz || !current) {
    return (
      <main className="grid min-h-[100dvh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-white/60" />
      </main>
    );
  }

  if (finalResult) {
    return (
      <>
        <Celebration
          open={celebrate}
          points={finalResult.xp_delta}
          streak={0}
          onClose={() => setCelebrate(false)}
        />
        <QuizFinal result={finalResult} />
      </>
    );
  }

  const timerPct = Math.max(0, Math.min(100, (timeLeft / totalMs) * 100));
  const progressPct = ((idx + (result ? 1 : 0)) / quiz.questions.length) * 100;

  return (
    <main className="relative min-h-[100dvh] w-full overflow-x-hidden pb-8">
      <CosmicBackground />
      <div className="mx-auto max-w-2xl px-4 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
        <header className="mb-3 flex items-center gap-2">
          <Link to="/quiz" className="glass flex h-10 w-10 items-center justify-center rounded-2xl text-white/80">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
              Question {idx + 1} / {quiz.questions.length} · {current.difficulty}
            </p>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-fuchsia-400 to-violet-400"
                animate={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-black text-amber-300">
            {totalPoints} pts
          </div>
        </header>

        {/* Timer — only after reveal */}
        {!result && revealed && (
          <div
            className="mb-3 h-1 w-full overflow-hidden rounded-full bg-white/5"
            role="progressbar"
            aria-label="Time remaining"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(timerPct)}
          >
            <motion.div
              className="h-full rounded-full"
              style={{
                background:
                  timerPct > 40
                    ? "linear-gradient(90deg,#a78bfa,#f0abfc)"
                    : "linear-gradient(90deg,#fb923c,#f43f5e)",
                width: `${timerPct}%`,
              }}
            />
          </div>
        )}

        {/* Screen-reader-only live region for result changes */}
        <div className="sr-only" aria-live="polite" aria-atomic="true">
          {result
            ? result.correct
              ? `Correct. You earned ${result.points_awarded} points.`
              : "Incorrect."
            : ""}
        </div>

        <AnimatePresence mode="wait">
          <motion.article
            key={idx}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="glass-strong rounded-3xl p-5"
          >
            <p className="text-[10px] font-black uppercase tracking-widest text-white/50">
              {emojiFor(current.category)} {current.category ?? "curiosity"}
            </p>
            <h2 className="mt-2 font-display text-xl font-black leading-tight text-white">
              {asWhyQuestion(current.question)}
            </h2>

            {!revealed ? (
              <div className="mt-5 space-y-3">
                <p id={`reveal-hint-${idx}`} className="text-sm text-white/70">
                  Take your time to read the question. When you're ready, reveal the answers — the timer starts then.
                </p>
                <button
                  ref={revealBtnRef}
                  type="button"
                  onClick={() => setRevealed(true)}
                  aria-describedby={`reveal-hint-${idx}`}
                  aria-label={`Reveal answers for question ${idx + 1} and start the timer`}
                  className="w-full rounded-full px-4 py-3 text-sm font-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
                  style={{ background: "var(--gradient-primary)" }}
                >
                  Reveal answers &amp; start timer
                </button>
              </div>
            ) : (
              <div
                className="mt-4 space-y-2"
                role="radiogroup"
                aria-label={`Answer choices for question ${idx + 1}`}
              >
                {current.choices.map((choice, i) => {
                  const isPicked = picked === i;
                  const isCorrect = result && result.correct_index === i;
                  const isWrongPick = result && isPicked && !result.correct;
                  const letter = String.fromCharCode(65 + i);
                  const stateLabel = isCorrect
                    ? "correct answer"
                    : isWrongPick
                      ? "your answer, incorrect"
                      : isPicked
                        ? "selected"
                        : "";
                  return (
                    <motion.button
                      key={i}
                      ref={i === 0 ? firstChoiceRef : undefined}
                      type="button"
                      role="radio"
                      aria-checked={isPicked}
                      aria-label={`Option ${letter}: ${choice}${stateLabel ? `, ${stateLabel}` : ""}`}
                      onClick={() => handlePick(i)}
                      disabled={answering || !!result}
                      whileTap={{ scale: 0.98 }}
                      className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent disabled:cursor-not-allowed ${
                        isCorrect
                          ? "border-emerald-400/50 bg-emerald-400/15"
                          : isWrongPick
                            ? "border-rose-400/50 bg-rose-400/15"
                            : isPicked
                              ? "border-white/30 bg-white/10"
                              : "border-white/10 bg-white/[0.04] hover:bg-white/[0.08]"
                      }`}
                    >
                      <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-black text-white/80">
                        {letter}
                      </span>
                      <span className="flex-1 text-sm font-semibold text-white">{choice}</span>
                      {isCorrect && <Check aria-hidden="true" className="h-4 w-4 text-emerald-300" />}
                      {isWrongPick && <X aria-hidden="true" className="h-4 w-4 text-rose-300" />}
                    </motion.button>
                  );
                })}
              </div>
            )}


            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`mt-4 rounded-2xl border p-3 ${
                    result.correct
                      ? "border-emerald-400/30 bg-emerald-400/10"
                      : "border-rose-400/30 bg-rose-400/10"
                  }`}
                >
                  <p className="text-sm font-black text-white">
                    {result.correct ? `✅ +${result.points_awarded} points` : "❌ Not quite"}
                  </p>
                  {result.explanation && (
                    <p className="mt-1 text-xs leading-relaxed text-white/80">{result.explanation}</p>
                  )}
                  {current.fun_fact && (
                    <p className="mt-2 text-xs italic text-yellow-200/90">⭐ {current.fun_fact}</p>
                  )}
                  <button
                    type="button"
                    onClick={next}
                    className="mt-3 w-full rounded-full px-4 py-2.5 text-sm font-black text-white"
                    style={{ background: "var(--gradient-primary)" }}
                  >
                    {idx + 1 >= quiz.questions.length ? "See results" : "Next question →"}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.article>
        </AnimatePresence>
      </div>
    </main>
  );
}

function QuizFinal({ result }: { result: FinishResult }) {
  const streak = result.perfect ? "🌟 PERFECT" : `${result.correct_count}/${result.question_count} correct`;
  return (
    <main className="relative min-h-[100dvh] w-full">
      <CosmicBackground />
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 pt-12 text-center sm:px-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="glass-strong w-full rounded-3xl p-6"
        >
          <Sparkles className="mx-auto h-10 w-10 text-amber-300" />
          <h1 className="mt-2 font-display text-3xl font-black text-white">Quiz complete!</h1>
          <p className="mt-1 text-sm text-white/70">{streak}</p>

          <div className="mt-5 grid grid-cols-3 gap-2 text-white">
            <Stat label="Score" value={result.score} />
            <Stat label="Accuracy" value={`${result.accuracy}%`} />
            <Stat label="+XP" value={`+${result.xp_delta}`} />
          </div>

          {result.perfect && (
            <p className="mt-4 rounded-2xl border border-amber-300/30 bg-amber-300/10 p-3 text-sm font-bold text-amber-200">
              🏆 Perfect run! +{result.bonus_points} bonus points
            </p>
          )}

          {result.unlocked_achievements.length > 0 && (
            <p className="mt-3 rounded-2xl border border-fuchsia-300/30 bg-fuchsia-500/10 p-3 text-sm font-bold text-fuchsia-100">
              🎖️ Unlocked: {result.unlocked_achievements.join(", ")}
            </p>
          )}

          <div className="mt-5 flex gap-2">
            <Link
              to="/quiz"
              className="flex-1 rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white"
            >
              Play again
            </Link>
            <Link
              to="/leaderboard"
              className="flex flex-1 items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-black text-white"
              style={{ background: "var(--gradient-primary)" }}
            >
              <Trophy className="h-4 w-4" /> Leaderboard
            </Link>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] p-3">
      <p className="text-[10px] font-black uppercase tracking-widest text-white/50">{label}</p>
      <p className="mt-0.5 text-lg font-black">{value}</p>
    </div>
  );
}
