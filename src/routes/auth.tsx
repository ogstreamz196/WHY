import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ArrowRight, Mail, Lock, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { CosmicBackground } from "@/components/CosmicBackground";

type Mode = "signin" | "signup" | "reset";

const searchSchema = z.object({
  mode: z.enum(["signin", "signup", "reset"]).optional(),
  redirect: z.string().optional(),
});

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Why?" },
      { name: "description", content: "Join a community of curious explorers." },
      { name: "theme-color", content: "#100c1f" },
    ],
  }),
  validateSearch: searchSchema,
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>(search.mode ?? "signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: search.redirect ?? "/" });
    });
  }, [navigate, search.redirect]);

  const heading =
    mode === "signup"
      ? "Join the curious"
      : mode === "signin"
      ? "Welcome back"
      : "Reset your password";
  const sub =
    mode === "signup"
      ? "Save your streak, favourites and Y-Coins across every device."
      : mode === "signin"
      ? "Continue your curiosity journey."
      : "We'll email you a magic link to set a new password.";

  function nextDestination(): string {
    try {
      const hasGuest =
        (Number(localStorage.getItem("why:points")) || 0) > 0 ||
        (Number(localStorage.getItem("why:streak")) || 0) > 0 ||
        (JSON.parse(localStorage.getItem("why:favorites") ?? "[]") as unknown[]).length > 0;
      if (hasGuest) {
        const redirect = search.redirect ?? "/";
        return `/import-guest?redirect=${encodeURIComponent(redirect)}`;
      }
    } catch {
      // ignore
    }
    return search.redirect ?? "/";
  }

  async function handleOAuth(provider: "google" | "apple") {
    setLoading(true);
    setMessage(null);
    try {
      const result = await lovable.auth.signInWithOAuth(provider, {
        redirect_uri: `${window.location.origin}/auth/callback`,
      });
      if (result.error) {
        setMessage({ type: "error", text: `${provider === "apple" ? "Apple" : "Google"} sign-in failed. Please try again.` });
      } else if (!result.redirected) {
        navigate({ to: nextDestination() });
      }
    } finally {
      setLoading(false);
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      if (mode === "signup") {
        const parsed = z
          .object({
            email: z.string().email(),
            password: z.string().min(8, "at least 8 characters"),
            name: z.string().trim().min(1).max(60),
          })
          .safeParse({ email, password, name });
        if (!parsed.success) {
          setMessage({ type: "error", text: parsed.error.issues[0]?.message ?? "Invalid input" });
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { display_name: parsed.data.name },
          },
        });
        if (error) throw error;
        setMessage({
          type: "success",
          text: "Check your email to confirm — then sign in and your curiosity journey begins.",
        });
      } else if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: nextDestination() });
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        setMessage({ type: "success", text: "Reset link sent — check your inbox." });
      }
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Something went wrong",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-[100dvh] w-full items-center justify-center px-4 py-10">
      <CosmicBackground />
      <div className="mx-auto w-full max-w-md">
        <div className="mb-6 text-center">
          <motion.div
            initial={{ scale: 0.5, rotate: -20, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14 }}
            className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl text-4xl shadow-[var(--shadow-glow)]"
            style={{ background: "var(--gradient-primary)" }}
          >
            <Sparkles className="h-9 w-9 text-white" />
          </motion.div>
          <h1 className="font-display text-3xl font-black text-white">
            <span className="text-gradient">Why?</span>
          </h1>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest text-white/50">
            a pocket-sized universe
          </p>
        </div>

        <motion.div
          layout
          className="glass-strong rounded-4xl border border-white/10 p-6 shadow-[var(--shadow-card)]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
            >
              <h2 className="font-display text-2xl font-black text-white">{heading}</h2>
              <p className="mt-1 text-sm text-white/60">{sub}</p>
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 space-y-2">
            <button
              type="button"
              onClick={() => handleOAuth("google")}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 text-sm font-bold text-slate-900 shadow-md transition disabled:opacity-60"
            >
              <GoogleIcon />
              Continue with Google
            </button>
            <button
              type="button"
              onClick={() => handleOAuth("apple")}
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-black px-4 py-3 text-sm font-bold text-white shadow-md transition disabled:opacity-60"
            >
              <AppleIcon />
              Continue with Apple
            </button>
          </div>

          <div className="my-4 flex items-center gap-3 text-[10px] font-black uppercase tracking-widest text-white/40">
            <div className="h-px flex-1 bg-white/10" />
            or
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <form onSubmit={submit} className="space-y-3">
            {mode === "signup" && (
              <Field
                label="Your name"
                value={name}
                onChange={setName}
                placeholder="Curious Explorer"
                autoComplete="name"
              />
            )}
            <Field
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@example.com"
              icon={<Mail className="h-4 w-4 text-white/40" />}
              autoComplete="email"
            />
            {mode !== "reset" && (
              <Field
                label="Password"
                type="password"
                value={password}
                onChange={setPassword}
                placeholder="••••••••"
                icon={<Lock className="h-4 w-4 text-white/40" />}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
              />
            )}

            {message && (
              <div
                className={`rounded-2xl px-3 py-2 text-xs font-semibold ${
                  message.type === "error"
                    ? "bg-rose-500/10 text-rose-300"
                    : "bg-emerald-500/10 text-emerald-300"
                }`}
              >
                {message.text}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-black text-white shadow-[var(--shadow-glow)] transition disabled:opacity-60"
              style={{ background: "var(--gradient-primary)" }}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  {mode === "signup" && (<>Create account <ArrowRight className="h-4 w-4" /></>)}
                  {mode === "signin" && (<>Sign in <ArrowRight className="h-4 w-4" /></>)}
                  {mode === "reset"  && "Send reset link"}
                </>
              )}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
            {mode !== "signin" && (
              <button className="font-semibold text-white/70 hover:text-white" onClick={() => setMode("signin")}>
                Have an account? Sign in
              </button>
            )}
            {mode !== "signup" && (
              <button className="font-semibold text-white/70 hover:text-white" onClick={() => setMode("signup")}>
                New here? Create account
              </button>
            )}
            {mode === "signin" && (
              <button className="text-white/50 hover:text-white" onClick={() => setMode("reset")}>
                Forgot password?
              </button>
            )}
          </div>
        </motion.div>

        <div className="mt-6 text-center">
          <Link to="/" className="text-xs font-semibold text-white/50 hover:text-white/80">
            ← Keep exploring as a guest
          </Link>
        </div>
      </div>
    </main>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  icon,
  autoComplete,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  icon?: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-black uppercase tracking-widest text-white/50">
        {label}
      </span>
      <div className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2.5 focus-within:border-violet-400/50">
        {icon}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="w-full bg-transparent text-sm text-white placeholder-white/30 outline-none"
        />
      </div>
    </label>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2-1.9 3.3-4.7 3.3-8.2z"/>
      <path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2v2.9A11 11 0 0 0 12 23z"/>
      <path fill="#FBBC04" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7H2a11 11 0 0 0 0 10z"/>
      <path fill="#EA4335" d="M12 5.4c1.6 0 3 .6 4.2 1.7L19.4 4A11 11 0 0 0 2 7l3.7 2.9C6.6 7.3 9.1 5.4 12 5.4z"/>
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M16.365 1.43c0 1.14-.42 2.23-1.24 3.03-.88.87-2.06 1.44-3.14 1.35-.13-1.1.42-2.24 1.2-2.98.88-.86 2.28-1.47 3.18-1.4zM20.5 17.36c-.55 1.27-1.22 2.48-2.13 3.4-.79.8-1.79 1.79-3.07 1.79-1.24.02-1.65-.79-3.26-.79s-2.05.78-3.24.81c-1.28.05-2.25-.87-3.05-1.67-2.19-2.19-3.87-6.19-1.61-9.03 1.13-1.4 3.15-2.29 4.98-2.32 1.31-.03 2.55.88 3.36.88.79 0 2.31-1.09 3.9-.93.66.03 2.53.27 3.72 2.02-.09.06-2.23 1.3-2.21 3.87.03 3.08 2.71 4.1 2.61 3.97z"/>
    </svg>
  );
}
