import { describe, it, expect, vi } from "vitest";
import {
  parseBulkImportRows,
  dedupeAgainstExisting,
  BulkImportHeaderError,
} from "@/lib/bulkImport";

describe("parseBulkImportRows — header validation", () => {
  it("accepts question/answer aliases (q/a)", () => {
    const r = parseBulkImportRows([
      ["q", "a"],
      ["Why is the sky blue?", "Rayleigh scattering."],
    ]);
    expect(r.candidates).toHaveLength(1);
    expect(r.candidates[0].question).not.toMatch(/^why/i);
  });

  it("throws when required columns are missing", () => {
    expect(() =>
      parseBulkImportRows([["foo", "bar"], ["x", "y"]]),
    ).toThrow(BulkImportHeaderError);
  });

  it("returns a helpful error when no data rows", () => {
    const r = parseBulkImportRows([["question", "answer"]]);
    expect(r.candidates).toHaveLength(0);
    expect(r.errors[0].reason).toMatch(/no data/i);
  });
});

describe("parseBulkImportRows — normalization + skipping", () => {
  it("normalizes questions (strips leading 'why' and trailing '?')", () => {
    const r = parseBulkImportRows([
      ["question", "answer"],
      ["Why does the sky look blue?", "Scattering."],
    ]);
    expect(r.candidates[0].question).toBe("the sky look blue");
  });

  it("skips rows with empty question or answer", () => {
    const r = parseBulkImportRows([
      ["question", "answer"],
      ["", "answer here"],
      ["why is water wet?", ""],
    ]);
    expect(r.candidates).toHaveLength(0);
    expect(r.skipped).toBe(2);
  });

  it("records grammar errors with row numbers", () => {
    const r = parseBulkImportRows([
      ["question", "answer"],
      ["why does dinosaurs had feathers?", "insulation"],
    ]);
    expect(r.candidates).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].row).toBe(2);
  });

  it("uses defaultCategory when row has no category and tab name is not a category", () => {
    const r = parseBulkImportRows(
      [
        ["question", "answer"],
        ["why is the sky blue?", "scattering"],
      ],
      { range: "Sheet1!A1:Z10", defaultCategory: "science" },
    );
    expect(r.candidates[0].category).toBe("science");
  });

  it("uses tab name as fallback category when it matches a known key", () => {
    const r = parseBulkImportRows(
      [
        ["question", "answer"],
        ["why do birds fly?", "wings"],
      ],
      { range: "animals!A1:Z10" },
    );
    expect(r.candidates[0].category).toBe("animals");
  });

  it("ignores unknown category values in the row", () => {
    const r = parseBulkImportRows([
      ["question", "answer", "category"],
      ["why is grass green?", "chlorophyll", "not-a-category"],
    ]);
    expect(r.candidates[0].category).toBeNull();
  });
});

describe("dedupeAgainstExisting", () => {
  function makeAdmin(existing: Set<string>) {
    const maybeSingle = vi.fn();
    const admin = {
      from: () => ({
        select: () => ({
          ilike: (_col: string, val: string) => ({
            limit: () => ({
              maybeSingle: () =>
                Promise.resolve({ data: existing.has(val) ? { id: "x" } : null }),
            }),
          }),
        }),
      }),
    };
    return { admin, maybeSingle };
  }

  it("keeps novel candidates and flags dupes against facts.question", async () => {
    const { admin } = makeAdmin(new Set(["the sky is blue"]));
    const { toInsert, dupes } = await dedupeAgainstExisting(admin, [
      { question: "the sky is blue", answer: "a", fun_fact: null, category: null },
      { question: "flamingos stand on one leg", answer: "a", fun_fact: null, category: null },
    ]);
    expect(dupes).toBe(1);
    expect(toInsert).toHaveLength(1);
    expect(toInsert[0].question).toBe("flamingos stand on one leg");
  });

  it("returns empty when every candidate already exists", async () => {
    const { admin } = makeAdmin(new Set(["a", "b"]));
    const r = await dedupeAgainstExisting(admin, [
      { question: "a", answer: "x", fun_fact: null, category: null },
      { question: "b", answer: "y", fun_fact: null, category: null },
    ]);
    expect(r.dupes).toBe(2);
    expect(r.toInsert).toHaveLength(0);
  });
});
