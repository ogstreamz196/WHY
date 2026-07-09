// Server-only helpers to push facts into a professionally formatted Google Sheet.
// One tab per category. Header row is auto-created + frozen on first write.

const GATEWAY = "https://connector-gateway.lovable.dev/google_sheets/v4";

function requireEnv() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_SHEETS_API_KEY;
  const spreadsheetId = process.env.WHY_SHEET_ID;
  if (!lovableKey || !connKey || !spreadsheetId) return null;
  return { lovableKey, connKey, spreadsheetId };
}

function headers(env: { lovableKey: string; connKey: string }): Record<string, string> {
  return {
    Authorization: `Bearer ${env.lovableKey}`,
    "X-Connection-Api-Key": env.connKey,
    "Content-Type": "application/json",
  };
}

async function tabExists(env: ReturnType<typeof requireEnv>, tab: string): Promise<boolean> {
  if (!env) return false;
  const res = await fetch(`${GATEWAY}/spreadsheets/${env.spreadsheetId}?fields=sheets.properties.title`, {
    headers: headers(env),
  });
  if (!res.ok) return false;
  const body = (await res.json()) as { sheets?: { properties?: { title?: string } }[] };
  return !!body.sheets?.some((s) => s.properties?.title === tab);
}

async function createTab(env: NonNullable<ReturnType<typeof requireEnv>>, tab: string): Promise<void> {
  // Add sheet
  await fetch(`${GATEWAY}/spreadsheets/${env.spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      requests: [{ addSheet: { properties: { title: tab, gridProperties: { rowCount: 1000, columnCount: 6, frozenRowCount: 1 } } } }],
    }),
  });
  // Header row
  await fetch(
    `${GATEWAY}/spreadsheets/${env.spreadsheetId}/values/${tab}!A1:F1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: headers(env),
      body: JSON.stringify({
        values: [["Code", "Order", "Question", "Answer", "Fun Fact", "Created"]],
      }),
    },
  );
  // Format header (bold + colored background) via batchUpdate
  const sheetsRes = await fetch(
    `${GATEWAY}/spreadsheets/${env.spreadsheetId}?fields=sheets(properties(sheetId,title))`,
    { headers: headers(env) },
  );
  const meta = (await sheetsRes.json()) as {
    sheets?: { properties?: { sheetId?: number; title?: string } }[];
  };
  const sheetId = meta.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
  if (typeof sheetId !== "number") return;
  await fetch(`${GATEWAY}/spreadsheets/${env.spreadsheetId}:batchUpdate`, {
    method: "POST",
    headers: headers(env),
    body: JSON.stringify({
      requests: [
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.12, green: 0.16, blue: 0.35 },
                textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true, fontSize: 11 },
                horizontalAlignment: "CENTER",
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat,horizontalAlignment)",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 1 },
            properties: { pixelSize: 130 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 1, endIndex: 2 },
            properties: { pixelSize: 70 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 2, endIndex: 5 },
            properties: { pixelSize: 360 },
            fields: "pixelSize",
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId, dimension: "COLUMNS", startIndex: 5, endIndex: 6 },
            properties: { pixelSize: 170 },
            fields: "pixelSize",
          },
        },
      ],
    }),
  });
}

export async function appendFactToSheet(fact: {
  code: string;
  code_seq: number;
  category: string | null;
  question: string;
  answer: string;
  fun_fact: string | null;
  created_at?: string | null;
}): Promise<void> {
  const env = requireEnv();
  if (!env) return; // silently no-op if sheets not configured
  const tab = (fact.category ?? "uncategorized").toLowerCase();
  try {
    if (!(await tabExists(env, tab))) await createTab(env, tab);
    const created = fact.created_at ?? new Date().toISOString();
    await fetch(
      `${GATEWAY}/spreadsheets/${env.spreadsheetId}/values/${tab}!A:F:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: headers(env),
        body: JSON.stringify({
          values: [[fact.code, fact.code_seq, fact.question, fact.answer, fact.fun_fact ?? "", created]],
        }),
      },
    );
  } catch (e) {
    // Never let sheet sync break the app.
    console.warn("[why?] sheet append failed", (e as Error).message);
  }
}
