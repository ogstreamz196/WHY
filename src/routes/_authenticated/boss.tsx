import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Crown, Search, Save, Shield, Coins, UserCog, ScrollText } from "lucide-react";
import {
  bossAmIBoss,
  bossListUsers,
  bossAdjustBalance,
  bossSetVip,
  bossGetPrivileges,
  bossUpdatePrivileges,
  bossListAudit,
  getGuestPromptSeconds,
  bossSetGuestPromptSeconds,
  type Privileges,
} from "@/lib/boss.functions";

export const Route = createFileRoute("/_authenticated/boss")({
  head: () => ({ meta: [{ title: "Boss Dashboard" }, { name: "robots", content: "noindex" }] }),
  component: BossDashboard,
});

function BossDashboard() {
  const qc = useQueryClient();
  const amIBoss = useServerFn(bossAmIBoss);
  const listUsers = useServerFn(bossListUsers);
  const adjust = useServerFn(bossAdjustBalance);
  const setVip = useServerFn(bossSetVip);
  const getPrivs = useServerFn(bossGetPrivileges);
  const updatePrivs = useServerFn(bossUpdatePrivileges);

  const boss = useQuery({ queryKey: ["boss:me"], queryFn: () => amIBoss() });
  const [search, setSearch] = useState("");
  const users = useQuery({
    queryKey: ["boss:users", search],
    queryFn: () => listUsers({ data: { search } }),
    enabled: !!boss.data?.isBoss,
  });
  const privs = useQuery({
    queryKey: ["boss:privileges"],
    queryFn: () => getPrivs(),
    enabled: !!boss.data?.isBoss,
  });

  const invalidateUsers = () => qc.invalidateQueries({ queryKey: ["boss:users"] });

  const adjustMut = useMutation({
    mutationFn: (v: { userId: string; delta?: number; setTo?: number }) => adjust({ data: v }),
    onSuccess: () => {
      toast.success("Balance updated");
      invalidateUsers();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const vipMut = useMutation({
    mutationFn: (v: { userId: string; grant: boolean; days?: number }) => setVip({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.grant ? "VIP granted" : "VIP revoked");
      invalidateUsers();
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });
  const privMut = useMutation({
    mutationFn: (v: Privileges) => updatePrivs({ data: v }),
    onSuccess: () => {
      toast.success("Privileges saved");
      qc.invalidateQueries({ queryKey: ["boss:privileges"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Failed"),
  });

  if (boss.isPending) {
    return <Shell><p className="text-white/60">Loading…</p></Shell>;
  }
  if (!boss.data?.isBoss) {
    return (
      <Shell>
        <div className="rounded-2xl border border-red-400/30 bg-red-500/10 p-6 text-center">
          <Shield className="mx-auto mb-2 h-6 w-6 text-red-300" />
          <p className="font-black text-white">Access denied</p>
          <p className="mt-1 text-sm text-white/60">Boss account only.</p>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <PrivilegesEditor initial={privs.data ?? null} onSave={(v) => privMut.mutate(v)} saving={privMut.isPending} />

      <GuestPromptEditor />


      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <UserCog className="h-4 w-4 text-sky-300" />
          <h2 className="text-lg font-black text-white">User controls</h2>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by email…"
            className="w-full rounded-full border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-white outline-none focus:border-sky-400/40"
          />
        </div>
        <ul className="space-y-2">
          {(users.data?.users ?? []).map((u) => (
            <UserRow
              key={u.id}
              row={u}
              onAdjust={(delta, setTo) => {
                const label =
                  setTo !== undefined
                    ? `set balance to ${setTo.toLocaleString()}`
                    : `${(delta ?? 0) >= 0 ? "add" : "remove"} ${Math.abs(delta ?? 0).toLocaleString()} coins`;
                if (!window.confirm(`Confirm: ${label} for ${u.email ?? u.id}?`)) return;
                adjustMut.mutate({ userId: u.id, delta, setTo });
              }}
              onVip={(grant, days) => {
                const label = grant
                  ? `grant VIP for ${days ?? 30} days to ${u.email ?? u.id}`
                  : `revoke VIP from ${u.email ?? u.id}`;
                if (!window.confirm(`Confirm: ${label}?`)) return;
                vipMut.mutate({ userId: u.id, grant, days });
              }}
              busy={adjustMut.isPending || vipMut.isPending}
            />
          ))}
          {users.isSuccess && users.data.users.length === 0 && (
            <li className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-sm text-white/60">
              No users match.
            </li>
          )}
        </ul>
      </section>

      <FactCodeDecoder />
      <AuditLogSection />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-2xl px-4 pb-24 pt-6">
      <header className="mb-6 flex items-center gap-3">
        <Link
          to="/profile"
          className="grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-white/80 hover:bg-white/10"
          aria-label="Back to profile"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex-1">
          <p className="text-[10px] font-black uppercase tracking-[0.25em] text-amber-300/80">Dev · Boss only</p>
          <h1 className="flex items-center gap-2 font-display text-2xl font-black text-white">
            <Crown className="h-5 w-5 fill-amber-400 text-amber-400" /> Boss Dashboard
          </h1>
        </div>
      </header>
      {children}
    </main>
  );
}

function UserRow({
  row,
  onAdjust,
  onVip,
  busy,
}: {
  row: { id: string; email: string | null; display_name: string | null; total_points: number; is_vip: boolean };
  onAdjust: (delta?: number, setTo?: number) => void;
  onVip: (grant: boolean, days?: number) => void;
  busy: boolean;
}) {
  const [amount, setAmount] = useState("100");
  const [setAmt, setSetAmt] = useState(String(row.total_points));
  const n = parseInt(amount, 10) || 0;
  const setN = parseInt(setAmt, 10);
  return (
    <li className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sm font-black text-white/80">
          {(row.display_name || row.email || "?").slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-black text-white">{row.display_name || row.email || row.id}</p>
          <p className="truncate text-[11px] text-white/50">{row.email}</p>
          <div className="mt-1 flex items-center gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1 rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 font-black text-amber-100">
              <Coins className="h-3 w-3" /> {row.total_points.toLocaleString()}
            </span>
            {row.is_vip && (
              <span className="inline-flex items-center gap-1 rounded-full border border-fuchsia-300/25 bg-fuchsia-400/10 px-2 py-0.5 font-black text-fuchsia-100">
                <Crown className="h-3 w-3" /> VIP
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="flex gap-1">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
            aria-label="Delta amount"
          />
          <button
            disabled={busy}
            onClick={() => onAdjust(+n)}
            className="rounded-lg border border-emerald-400/30 bg-emerald-500/15 px-2 py-1.5 text-xs font-black text-emerald-100"
          >
            +
          </button>
          <button
            disabled={busy}
            onClick={() => onAdjust(-n)}
            className="rounded-lg border border-red-400/30 bg-red-500/15 px-2 py-1.5 text-xs font-black text-red-100"
          >
            −
          </button>
        </div>
        <div className="flex gap-1">
          <input
            value={setAmt}
            onChange={(e) => setSetAmt(e.target.value)}
            inputMode="numeric"
            className="w-full rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
            aria-label="Set balance to"
          />
          <button
            disabled={busy || Number.isNaN(setN)}
            onClick={() => onAdjust(undefined, setN)}
            className="rounded-lg border border-sky-400/30 bg-sky-500/15 px-2 py-1.5 text-xs font-black text-sky-100"
          >
            Set
          </button>
        </div>
      </div>
      <div className="mt-2 flex gap-2">
        {row.is_vip ? (
          <button
            disabled={busy}
            onClick={() => onVip(false)}
            className="flex-1 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs font-black text-white/80"
          >
            Revoke VIP
          </button>
        ) : (
          <>
            <button
              disabled={busy}
              onClick={() => onVip(true, 30)}
              className="flex-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 px-2 py-1.5 text-xs font-black text-fuchsia-100"
            >
              Grant VIP · 30d
            </button>
            <button
              disabled={busy}
              onClick={() => onVip(true, 365)}
              className="flex-1 rounded-lg border border-fuchsia-400/30 bg-fuchsia-500/15 px-2 py-1.5 text-xs font-black text-fuchsia-100"
            >
              1 year
            </button>
          </>
        )}
      </div>
    </li>
  );
}

const DEFAULT_PRIVS: Privileges = {
  free: { daily_facts_limit: 20, quiz_daily_limit: 3, coin_multiplier: 1, ads_enabled: true },
  vip: { daily_facts_limit: 999, quiz_daily_limit: 999, coin_multiplier: 1.5, ads_enabled: false },
};

function PrivilegesEditor({
  initial,
  onSave,
  saving,
}: {
  initial: Privileges | null;
  onSave: (v: Privileges) => void;
  saving: boolean;
}) {
  const seed = useMemo(() => initial ?? DEFAULT_PRIVS, [initial]);
  const [free, setFree] = useState(seed.free);
  const [vip, setVip] = useState(seed.vip);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-amber-300" />
        <h2 className="text-lg font-black text-white">Privileges</h2>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TierEditor label="Free" tone="text-white/80" value={free} onChange={setFree} />
        <TierEditor label="VIP" tone="text-fuchsia-200" value={vip} onChange={setVip} />
      </div>
      <button
        onClick={() => onSave({ free, vip })}
        disabled={saving}
        className="mt-3 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-4 py-2 text-sm font-black text-emerald-100 disabled:opacity-60"
      >
        <Save className="h-4 w-4" /> {saving ? "Saving…" : "Save privileges"}
      </button>
    </section>
  );
}

function TierEditor({
  label,
  tone,
  value,
  onChange,
}: {
  label: string;
  tone: string;
  value: Privileges["free"];
  onChange: (v: Privileges["free"]) => void;
}) {
  const num = (k: keyof Privileges["free"], step = 1) => (
    <label className="flex items-center justify-between gap-2 text-xs text-white/70">
      <span className="capitalize">{String(k).replace(/_/g, " ")}</span>
      <input
        type="number"
        step={step}
        value={value[k] as number}
        onChange={(e) => onChange({ ...value, [k]: Number(e.target.value) })}
        className="w-24 rounded-lg border border-white/10 bg-white/5 px-2 py-1 text-right text-xs text-white outline-none"
      />
    </label>
  );
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
      <p className={`mb-2 text-xs font-black uppercase tracking-widest ${tone}`}>{label}</p>
      <div className="space-y-2">
        {num("daily_facts_limit")}
        {num("quiz_daily_limit")}
        {num("coin_multiplier", 0.1)}
        <label className="flex items-center justify-between gap-2 text-xs text-white/70">
          <span>Ads enabled</span>
          <input
            type="checkbox"
            checked={value.ads_enabled}
            onChange={(e) => onChange({ ...value, ads_enabled: e.target.checked })}
            className="h-4 w-4"
          />
        </label>
      </div>
    </div>
  );
}

const ACTION_OPTIONS = [
  { value: "", label: "All actions" },
  { value: "adjust_balance", label: "Adjust balance" },
  { value: "grant_vip", label: "Grant VIP" },
  { value: "revoke_vip", label: "Revoke VIP" },
  { value: "update_privileges", label: "Update privileges" },
];

type AuditRow = {
  id: string;
  actor_id: string;
  target_user_id: string | null;
  action: string;
  details: any;
  created_at: string;
  target_email: string | null;
  actor_email: string | null;
};

function AuditLogSection() {
  const list = useServerFn(bossListAudit);
  const [action, setAction] = useState("");
  const [email, setEmail] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [selected, setSelected] = useState<AuditRow | null>(null);

  const filters = useMemo(
    () => ({
      action: action || undefined,
      email: email || undefined,
      from: from ? new Date(from).toISOString() : undefined,
      to: to ? new Date(to + "T23:59:59").toISOString() : undefined,
      limit: 200,
    }),
    [action, email, from, to],
  );

  const q = useQuery({
    queryKey: ["boss:audit", filters],
    queryFn: () => list({ data: filters }),
    refetchOnWindowFocus: false,
  });
  const entries = (q.data?.entries ?? []) as AuditRow[];

  const download = (blob: Blob, name: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  };
  const exportJson = () => {
    download(
      new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" }),
      `boss-audit-${new Date().toISOString().slice(0, 10)}.json`,
    );
  };
  const exportCsv = () => {
    const headers = ["created_at", "action", "actor_email", "target_email", "target_user_id", "details"];
    const esc = (v: any) => {
      const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = entries.map((e) =>
      [e.created_at, e.action, e.actor_email, e.target_email, e.target_user_id, e.details].map(esc).join(","),
    );
    download(
      new Blob([[headers.join(","), ...rows].join("\n")], { type: "text/csv" }),
      `boss-audit-${new Date().toISOString().slice(0, 10)}.csv`,
    );
  };

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ScrollText className="h-4 w-4 text-amber-300" />
          <h2 className="text-lg font-black text-white">Audit log</h2>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={exportCsv}
            disabled={entries.length === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black text-white/80 disabled:opacity-40"
          >
            CSV
          </button>
          <button
            onClick={exportJson}
            disabled={entries.length === 0}
            className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-black text-white/80 disabled:opacity-40"
          >
            JSON
          </button>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select
          value={action}
          onChange={(e) => setAction(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
          aria-label="Filter by action"
        >
          {ACTION_OPTIONS.map((o) => (
            <option key={o.value} value={o.value} className="bg-neutral-900">
              {o.label}
            </option>
          ))}
        </select>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Target email…"
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
        />
        <input
          type="date"
          value={from}
          onChange={(e) => setFrom(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
          aria-label="From date"
        />
        <input
          type="date"
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs text-white outline-none"
          aria-label="To date"
        />
      </div>

      {q.isPending ? (
        <p className="text-xs text-white/50">Loading…</p>
      ) : entries.length === 0 ? (
        <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-center text-xs text-white/60">
          No admin actions match these filters.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {entries.map((e) => (
            <li key={e.id}>
              <button
                onClick={() => setSelected(e)}
                className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-[11px] text-white/80 hover:bg-white/[0.06]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-black uppercase tracking-wider text-amber-200">
                    {e.action.replace(/_/g, " ")}
                  </span>
                  <span className="text-white/40">{new Date(e.created_at).toLocaleString()}</span>
                </div>
                {e.target_email && <div className="mt-0.5 truncate text-white/60">→ {e.target_email}</div>}
                <div className="mt-0.5 text-white/50">{summarize(e)}</div>
              </button>
            </li>
          ))}
        </ul>
      )}

      <AuditDetailDrawer entry={selected} onClose={() => setSelected(null)} />
    </section>
  );
}

function summarize(e: AuditRow): string {
  const d = e.details ?? {};
  if (e.action === "adjust_balance") {
    return `Balance ${d.previous ?? "?"} → ${d.next ?? "?"}`;
  }
  if (e.action === "grant_vip") {
    const end = d.next?.period_end ? new Date(d.next.period_end).toLocaleDateString() : "";
    return `VIP granted${d.days ? ` · ${d.days}d` : ""}${end ? ` · until ${end}` : ""}`;
  }
  if (e.action === "revoke_vip") return "VIP revoked";
  if (e.action === "update_privileges") return "Free/VIP privileges updated";
  return "";
}

function AuditDetailDrawer({ entry, onClose }: { entry: AuditRow | null; onClose: () => void }) {
  if (!entry) return null;
  const d = entry.details ?? {};
  const prev = d.previous;
  const next = d.next;
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Audit entry details"
    >
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-t-2xl border border-white/10 bg-neutral-950 p-5 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-300/80">
              {entry.action.replace(/_/g, " ")}
            </p>
            <p className="mt-0.5 text-xs text-white/60">{new Date(entry.created_at).toLocaleString()}</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-black text-white/80"
          >
            Close
          </button>
        </div>

        <div className="mb-3 space-y-1 text-xs text-white/70">
          <div>
            <span className="text-white/40">Actor:</span> {entry.actor_email ?? entry.actor_id}
          </div>
          {entry.target_email && (
            <div>
              <span className="text-white/40">Target:</span> {entry.target_email}
            </div>
          )}
          <div className="text-white/80">{summarize(entry)}</div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2">
          <DiffBlock title="Before" value={prev} />
          <DiffBlock title="After" value={next} />
        </div>

        {(!prev && !next) && (
          <div className="mt-3">
            <DiffBlock title="Details" value={d} />
          </div>
        )}
      </div>
    </div>
  );
}

function DiffBlock({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
      <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-white/50">{title}</p>
      <pre className="max-h-56 overflow-auto whitespace-pre-wrap break-words text-[11px] text-white/80">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function FactCodeDecoder() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onDecode = async () => {
    setBusy(true); setErr(null); setResult(null);
    try {
      const { decodeFactCode } = await import("@/lib/facts.functions");
      const r = await decodeFactCode({ data: { code: code.trim() } });
      if (!r) setErr("No fact matches that code.");
      else setResult(r);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Failed to decode");
    } finally { setBusy(false); }
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-3 flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-300" />
        <h2 className="text-lg font-black text-white">Fact code decoder</h2>
      </div>
      <div className="flex gap-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="WHY-XXXXXX"
          className="flex-1 rounded-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-mono uppercase tracking-wider text-white outline-none focus:border-emerald-400/40"
        />
        <button
          onClick={onDecode}
          disabled={busy || code.trim().length < 4}
          className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-black text-black disabled:opacity-40"
        >
          {busy ? "…" : "Decode"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
      {result != null && (
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-xl border border-white/10 bg-black/40 p-3 text-[11px] text-white/80">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </section>
  );
}


