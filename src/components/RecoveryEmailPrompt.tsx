import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useCurrentUser } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PLACEHOLDER_DOMAIN, setRecoveryEmail } from "@/lib/username-auth.functions";

const KEY = "why:last_recovery_prompt";
const today = () => new Date().toISOString().slice(0, 10);

/** Once a day, gently asks username-only accounts for a password-recovery email. */
export function RecoveryEmailPrompt() {
  const { user } = useCurrentUser();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email?.endsWith(`@${PLACEHOLDER_DOMAIN}`)) {
      setOpen(false);
      return;
    }
    try {
      if (window.localStorage.getItem(KEY) === today()) return;
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => setOpen(true), 1500);
    return () => window.clearTimeout(t);
  }, [user?.email]);

  function later() {
    try {
      window.localStorage.setItem(KEY, today());
    } catch {
      /* ignore */
    }
    setOpen(false);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const res = await setRecoveryEmail({ data: { email } });
      if ("error" in res) {
        setError(res.error ?? "Couldn't save the email.");
        return;
      }
      await supabase.auth.refreshSession();
      setOpen(false);
      toast.success("Backup email saved 🔑");
    } catch {
      setError("Please enter a valid email.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="recovery-title"
      className="overlay-scroll fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4"
    >
      <form
        onSubmit={save}
        className="glass-strong w-full max-w-sm rounded-4xl border border-white/10 p-6 text-white shadow-[var(--shadow-card)]"
      >
        <h2 id="recovery-title" className="font-display text-2xl font-black">
          Don't get locked out! 🔑
        </h2>
        <p className="mt-2 text-sm text-white/80">
          Add a backup email so you never lose your progress if you forget your password.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          aria-label="Backup email"
          className="mt-4 w-full rounded-2xl border border-white/10 bg-white/[0.06] px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-violet-400"
        />
        {error && <p className="mt-2 text-xs font-semibold text-rose-300">{error}</p>}
        <p className="mt-3 text-xs italic text-white/60">
          Zero spam, pinky promise — strictly for password resets.
        </p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={later}
            className="flex-1 rounded-2xl border border-white/15 px-4 py-3 text-sm font-bold text-white/80"
          >
            Maybe tomorrow
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 rounded-2xl px-4 py-3 text-sm font-black text-white disabled:opacity-60"
            style={{ background: "var(--gradient-primary)" }}
          >
            {saving ? "Saving…" : "Save email"}
          </button>
        </div>
      </form>
    </div>
  );
}
