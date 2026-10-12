// Integration tests: verify that whichever insert path runs in
// src/lib/facts.functions.ts always saves the NORMALIZED question shape
// (from normalizeStoredQuestion) — never the raw AI candidate string.
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---- Mocks ---------------------------------------------------------------

// Bypass TanStack's server-fn wrapper — return the handler directly so we
// can invoke it in Node without SSR/middleware.
vi.mock("@tanstack/react-start", () => {
  const make = () => {
    const b: any = {
      _validator: (x: unknown) => x,
      middleware: () => b,
      inputValidator: (fn: (x: unknown) => unknown) => {
        b._validator = fn;
        return b;
      },
      handler: (fn: (arg: { data: unknown; context: any }) => unknown) => {
        return async (arg: { data?: unknown } = {}) =>
          fn({ data: b._validator(arg.data), context: { userId: "test-user" } });
      },
    };
    return b;
  };
  return { createServerFn: () => make() };
});

vi.mock("@/integrations/supabase/auth-middleware", () => ({
  requireSupabaseAuth: {},
}));

vi.mock("@/lib/aiQuota.server", () => ({
  consumeAiQuota: async () => true,
  consumeGuestAiQuota: async () => true,
  optionalUserId: async () => "test-user",
}));

// Track exactly what gets passed to .insert() on the facts table.
const insertSpy = vi.fn();

// Chainable admin/supabase-js client stub.
function chain(returnRows: unknown = null, opts: { count?: number } = {}) {
  const q: any = {
    select: vi.fn(() => q),
    insert: vi.fn((payload: unknown) => {
      insertSpy(payload);
      return {
        select: () => ({
          single: async () => ({
            data: {
              id: "inserted-1",
              question: (payload as any).question,
              answer: (payload as any).answer,
              category: (payload as any).category,
              fun_fact: (payload as any).fun_fact,
              code: "WHY-TEST01",
              code_seq: 1,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        }),
      };
    }),
    eq: vi.fn(() => q),
    ilike: vi.fn(() => q),
    order: vi.fn(() => q),
    limit: vi.fn(async () => ({ data: returnRows, count: opts.count ?? 0, error: null })),
  };
  // Make awaits after ilike / order / eq without limit also resolve.
  Object.defineProperty(q, "then", {
    value: (resolve: (v: unknown) => void) =>
      resolve({ data: returnRows, count: opts.count ?? 0, error: null }),
  });
  return q;
}

const adminClient = { from: vi.fn(() => chain([])) };
const publicClient = { from: vi.fn(() => chain([], { count: 0 })) };

vi.mock("@/integrations/supabase/client.server", () => ({
  supabaseAdmin: adminClient,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => publicClient,
}));

// AI: force qualityCheck to pass and generation to return a raw question that
// the normalizer must clean before saving.
const generateTextMock = vi.fn();
vi.mock("@/lib/ai-cascade.server", () => ({
  generateWithCascade: async (...a: unknown[]) =>
    ((await generateTextMock(...a)) as { text: string }).text,
}));

// sheets.server is fire-and-forget; stub it so tests don't touch network.
vi.mock("@/lib/sheets.server", () => ({ appendFactToSheet: vi.fn() }));

// ---- Test data -----------------------------------------------------------

// Raw question the model returns; normalizeStoredQuestion should strip the
// leading "Why " and trailing "?" so what lands in the DB is a lowercase
// phrase.
const RAW_CANDIDATE = {
  question: "Why the sky is blue?",
  answer: "Because sunlight scatters.",
  fun_fact: "Sunsets look red for the same reason.",
  category: "science",
};

const EXPECTED_STORED_QUESTION = "the sky is blue";

// generateText is called twice per successful path: generation, then
// qualityCheck. Return the candidate first, then { ok: true }.
function primeAi() {
  generateTextMock.mockReset();
  generateTextMock
    .mockResolvedValueOnce({ text: JSON.stringify(RAW_CANDIDATE) })
    .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
}

beforeEach(() => {
  insertSpy.mockReset();
  adminClient.from.mockClear();
  publicClient.from.mockClear();
  process.env.LOVABLE_API_KEY = "test-key";
  process.env.SUPABASE_URL = "http://localhost";
  process.env.SUPABASE_PUBLISHABLE_KEY = "pk";
});

// ---- Tests ---------------------------------------------------------------

describe("facts.functions.ts — normalized question is what gets stored", () => {
  it("generateAndStoreFact inserts the normalized question shape", async () => {
    primeAi();
    // Import AFTER mocks are registered.
    const mod = await import("@/lib/facts.functions");
    // force:true so the "serve existing pool first" branch is skipped.
    const result: any = await (mod.generateAndStoreFact as any)({
      data: { force: true, category: "science" },
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.question).toBe(EXPECTED_STORED_QUESTION);
    expect(payload.question).not.toMatch(/^why\s/i);
    expect(payload.question).not.toMatch(/\?$/);
    expect(result?.question).toBe(EXPECTED_STORED_QUESTION);
  });

  it("searchOrGenerateFact inserts the normalized question shape", async () => {
    primeAi();
    const mod = await import("@/lib/facts.functions");
    const result: any = await (mod.searchOrGenerateFact as any)({
      data: { query: "why is the sky blue" },
    });
    expect(insertSpy).toHaveBeenCalledTimes(1);
    const payload = insertSpy.mock.calls[0][0];
    expect(payload.question).toBe(EXPECTED_STORED_QUESTION);
    expect(payload.question).not.toMatch(/^why\s/i);
    expect(payload.question).not.toMatch(/\?$/);
    expect(result?.question).toBe(EXPECTED_STORED_QUESTION);
  });

  it("rejects (does not insert) when normalizer flags bad grammar", async () => {
    generateTextMock.mockReset();
    // "why does dinosaurs had feathers" trips the past-tense-after-does rule.
    const bad = { ...RAW_CANDIDATE, question: "why does dinosaurs had feathers?" };
    // 3 attempts × (gen + qualityCheck) — always feed the same bad candidate.
    for (let i = 0; i < 3; i++) {
      generateTextMock
        .mockResolvedValueOnce({ text: JSON.stringify(bad) })
        .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
    }
    const mod = await import("@/lib/facts.functions");
    await (mod.generateAndStoreFact as any)({ data: { force: true, category: "science" } });
    expect(insertSpy).not.toHaveBeenCalled();
  });
});
