// Google Drive master backup ("WHY App - Master Backup").
// A spreadsheet created automatically in the connected Google account's Drive,
// with three tabs: Facts, Users & Coins, Purchases & Plus. Its ID is kept in
// app_config (key "backup_sheet_id"), so nothing has to be pasted by hand.
// The database stays the source of truth; the sheet is a mirror for restores.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";
const ID_KEY = "backup_sheet_id";
const LAST_SYNC_KEY = "backup_last_people_sync";
const PEOPLE_SYNC_MIN_MS = 60_000;

export const BACKUP_TITLE = "WHY App - Master Backup";
export const TABS = {
  facts: "Facts",
  users: "Users & Coins",
  purchases: "Purchases & Plus",
} as const;

export const HEADERS = {
  facts: ["Code", "Category", "Question", "Answer", "Fun Fact", "Source", "Created At", "Fact ID"],
  users: [
    "User ID",
    "Nickname",
    "Username",
    "Coins",
    "Current Streak",
    "Longest Streak",
    "Login Streak",
    "Facts Seen",
    "Last Active",
    "Joined",
  ],
  purchases: ["User ID", "Kind", "Item / Tier", "Store", "Status", "Cost / Ends", "Date"],
};

type Cell = string | number | boolean;

function env() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  if (!lovableKey || !connKey) return null;
  return { lovableKey, connKey };
}

async function sheets(path: string, init: RequestInit = {}) {
  const e = env();
  if (!e) throw new Error("Google Sheets is not connected");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${e.lovableKey}`,
      "X-Connection-Api-Key": e.connKey,
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Google Sheets [${res.status}]: ${body.slice(0, 300)}`);
  }
  return res.json() as Promise<any>;
}

async function db() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

async function getConfig(key: string): Promise<any> {
  const { data } = await (await db()).from("app_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? null;
}

async function setConfig(key: string, value: unknown) {
  await (await db())
    .from("app_config")
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
}

const q = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/** Page through a table (the API returns at most 1000 rows per request). */
async function fetchAll(table: string, cols: string, order: string): Promise<any[]> {
  const client = await db();
  const out: any[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await client
      .from(table)
      .select(cols)
      .order(order, { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`${table}: ${error.message}`);
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

export function factRow(f: any): Cell[] {
  return [
    f.code ?? "",
    f.category ?? "",
    f.question ?? "",
    f.answer ?? "",
    f.fun_fact ?? "",
    f.source ?? "",
    f.created_at ?? new Date().toISOString(),
    f.id ?? "",
  ];
}

async function buildRows() {
  const [facts, profiles, stats, inventory, subs] = await Promise.all([
    fetchAll("facts", "id, code, category, question, answer, fun_fact, source, created_at, is_adult", "created_at"),
    fetchAll("profiles", "id, display_name, username, created_at", "created_at"),
    fetchAll(
      "user_stats",
      "user_id, total_points, current_streak, longest_streak, login_streak, facts_seen, last_active_day",
      "user_id",
    ),
    fetchAll("user_inventory", "user_id, item_id, cost, acquired_at", "acquired_at"),
    fetchAll("subscriptions", "user_id, product_id, status, current_period_end, created_at", "created_at").catch(
      () => [],
    ),
  ]);
  // App-store Plus (table may not exist yet).
  const store = await fetchAll(
    "plus_entitlements",
    "user_id, product_id, store, expires_at, updated_at",
    "updated_at",
  ).catch(() => []);

  const statBy = new Map(stats.map((s) => [s.user_id, s]));
  const users: Cell[][] = profiles.map((p) => {
    const s = statBy.get(p.id) ?? {};
    return [
      p.id,
      p.display_name ?? "",
      p.username ?? "",
      s.total_points ?? 0,
      s.current_streak ?? 0,
      s.longest_streak ?? 0,
      s.login_streak ?? 0,
      s.facts_seen ?? 0,
      s.last_active_day ?? "",
      p.created_at ?? "",
    ];
  });
  const purchases: Cell[][] = [
    ...inventory.map((i) => [i.user_id, "store_item", i.item_id, "coins", "owned", i.cost ?? 0, i.acquired_at ?? ""]),
    ...subs.map((s: any) => [
      s.user_id,
      "plus",
      s.product_id ?? "plus",
      "web",
      s.status ?? "",
      s.current_period_end ?? "",
      s.created_at ?? "",
    ]),
    ...store.map((s: any) => [
      s.user_id,
      "plus",
      s.product_id ?? "plus",
      s.store ?? "store",
      s.expires_at && new Date(s.expires_at).getTime() < Date.now() ? "expired" : "active",
      s.expires_at ?? "",
      s.updated_at ?? "",
    ]),
  ];
  return { facts: facts.filter((f) => !f.is_adult).map(factRow), users, purchases };
}

/** Overwrite whole tabs (header + rows). Two API calls regardless of size. */
async function writeTabs(id: string, which: Partial<Record<keyof typeof TABS, Cell[][]>>) {
  const keys = Object.keys(which) as (keyof typeof TABS)[];
  await sheets(`/spreadsheets/${id}/values:batchClear`, {
    method: "POST",
    body: JSON.stringify({ ranges: keys.map((k) => q(TABS[k])) }),
  });
  await sheets(`/spreadsheets/${id}/values:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      valueInputOption: "RAW",
      data: keys.map((k) => ({ range: `${q(TABS[k])}!A1`, values: [HEADERS[k], ...(which[k] ?? [])] })),
    }),
  });
}

async function createSpreadsheet(): Promise<string> {
  const created = await sheets(`/spreadsheets`, {
    method: "POST",
    body: JSON.stringify({
      properties: { title: BACKUP_TITLE },
      sheets: Object.values(TABS).map((title) => ({
        properties: { title, gridProperties: { frozenRowCount: 1 } },
      })),
    }),
  });
  const id = created.spreadsheetId as string;
  const sheetIds: number[] = (created.sheets ?? []).map((s: any) => s.properties.sheetId);
  await sheets(`/spreadsheets/${id}:batchUpdate`, {
    method: "POST",
    body: JSON.stringify({
      requests: sheetIds.map((sheetId) => ({
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.12, green: 0.16, blue: 0.35 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      })),
    }),
  });
  return id;
}

/** The backup spreadsheet ID, creating (and fully filling) the file on first use. */
export async function ensureBackupSheet(): Promise<string | null> {
  if (!env()) return null;
  const saved = (await getConfig(ID_KEY)) as { id?: string } | null;
  if (saved?.id) return saved.id;
  const id = await createSpreadsheet();
  await setConfig(ID_KEY, { id, created_at: new Date().toISOString() });
  await writeTabs(id, await buildRows());
  await setConfig(LAST_SYNC_KEY, { at: Date.now() });
  return id;
}

export async function backupStatus() {
  const saved = (await getConfig(ID_KEY)) as { id?: string } | null;
  const last = (await getConfig(LAST_SYNC_KEY)) as { at?: number } | null;
  return {
    connected: !!env(),
    sheetId: saved?.id ?? null,
    url: saved?.id ? `https://docs.google.com/spreadsheets/d/${saved.id}/edit` : null,
    lastSyncAt: last?.at ? new Date(last.at).toISOString() : null,
  };
}

/** Rewrite every tab from the database. */
export async function fullBackup() {
  const id = await ensureBackupSheet();
  if (!id) throw new Error("Google Sheets is not connected");
  const rows = await buildRows();
  await writeTabs(id, rows);
  await setConfig(LAST_SYNC_KEY, { at: Date.now() });
  return { facts: rows.facts.length, users: rows.users.length, purchases: rows.purchases.length };
}

/**
 * Called after coins or purchases change. Refreshes the people tabs at most
 * once a minute (keeps well inside Google's quota); never throws.
 */
export async function syncPeopleSoon(): Promise<void> {
  try {
    if (!env()) return;
    const last = (await getConfig(LAST_SYNC_KEY)) as { at?: number } | null;
    if (last?.at && Date.now() - last.at < PEOPLE_SYNC_MIN_MS) return;
    await setConfig(LAST_SYNC_KEY, { at: Date.now() }); // claim the slot first
    const id = await ensureBackupSheet();
    if (!id) return;
    const { users, purchases } = await buildRows();
    await writeTabs(id, { users, purchases });
  } catch (e) {
    console.warn("[backup] people sync failed", (e as Error).message);
  }
}

/** Append one new fact to the Facts tab in real time; never throws. */
export async function appendFactToBackup(fact: any): Promise<void> {
  try {
    const id = await ensureBackupSheet();
    if (!id) return;
    await sheets(
      `/spreadsheets/${id}/values/${encodeURIComponent(TABS.facts)}!A:H:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: [factRow(fact)] }) },
    );
  } catch (e) {
    console.warn("[backup] fact append failed", (e as Error).message);
  }
}

/**
 * Restore from the backup into this workspace's database. Facts are inserted
 * when their question is missing. Coins and store items are restored only for
 * accounts that already exist here (accounts themselves live in sign-in).
 */
export async function restoreFromBackup(sheetIdOverride?: string) {
  const id = sheetIdOverride || ((await getConfig(ID_KEY)) as { id?: string } | null)?.id;
  if (!id) throw new Error("No backup file found yet");
  const params = new URLSearchParams();
  for (const t of Object.values(TABS)) params.append("ranges", q(t));
  const res = await sheets(`/spreadsheets/${id}/values:batchGet?${params.toString()}`);
  const [factVals, userVals, purchaseVals] = (res.valueRanges ?? []).map(
    (r: any) => ((r.values ?? []) as string[][]).slice(1),
  );
  const client = await db();

  // Facts
  const existing = new Set((await fetchAll("facts", "question", "question")).map((f) => f.question));
  const newFacts = (factVals ?? [])
    .filter((r: string[]) => r[2] && r[3] && !existing.has(r[2]))
    .map((r: string[]) => ({
      category: r[1] || null,
      question: r[2],
      answer: r[3],
      fun_fact: r[4] || null,
      source: r[5] || "backup",
    }));
  let factsRestored = 0;
  for (let i = 0; i < newFacts.length; i += 200) {
    const { error, count } = await client
      .from("facts")
      .insert(newFacts.slice(i, i + 200), { count: "exact" });
    if (error) throw new Error(`facts: ${error.message}`);
    factsRestored += count ?? 0;
  }

  const known = new Set((await fetchAll("profiles", "id", "id")).map((p) => p.id));

  // Coins & streaks
  const statRows = (userVals ?? [])
    .filter((r: string[]) => known.has(r[0]))
    .map((r: string[]) => ({
      user_id: r[0],
      total_points: Number(r[3]) || 0,
      current_streak: Number(r[4]) || 0,
      longest_streak: Number(r[5]) || 0,
      login_streak: Number(r[6]) || 0,
      facts_seen: Number(r[7]) || 0,
      last_active_day: r[8] || null,
    }));
  if (statRows.length) {
    const { error } = await client.from("user_stats").upsert(statRows, { onConflict: "user_id" });
    if (error) throw new Error(`user_stats: ${error.message}`);
  }

  // Store items (Plus subscriptions come back from the stores / Paddle themselves)
  const invRows = (purchaseVals ?? [])
    .filter((r: string[]) => r[1] === "store_item" && known.has(r[0]))
    .map((r: string[]) => ({
      user_id: r[0],
      item_id: r[2],
      cost: Number(r[5]) || 0,
      acquired_at: r[6] || new Date().toISOString(),
    }));
  if (invRows.length) {
    const { error } = await client
      .from("user_inventory")
      .upsert(invRows, { onConflict: "user_id,item_id", ignoreDuplicates: true });
    if (error) throw new Error(`user_inventory: ${error.message}`);
  }

  if (sheetIdOverride) await setConfig(ID_KEY, { id: sheetIdOverride });
  return { factsRestored, usersRestored: statRows.length, itemsRestored: invRows.length };
}
