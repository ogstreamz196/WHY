import { describe, it, expect } from "vitest";
import { asWhyQuestion } from "@/lib/whyQuestion";
import { normalizeStoredQuestion } from "@/lib/normalizeQuestion";

describe("asWhyQuestion — past tense handling", () => {
  const cases: Array<[string, string]> = [
    ["some dinosaurs had feathers", "Why did some dinosaurs have feathers?"],
    ["romans built roads", "Why did romans build roads?"],
    ["the pyramids were built by hand", "Why were the pyramids built by hand?"],
    ["mammoths went extinct", "Why did mammoths go extinct?"],
    ["edison invented the bulb", "Why did edison invent the bulb?"],
    ["humans evolved from apes", "Why did humans evolve from apes?"],
    ["the dodo was flightless", "Why was the dodo flightless?"],
    ["ancient people used fire", "Why did ancient people use fire?"],
  ];
  it.each(cases)("asks past-tense facts with did/was/were: %j", (input, expected) => {
    expect(asWhyQuestion(input)).toBe(expected);
  });

  it("never injects 'does' before a past-tense verb", () => {
    const inputs = [
      "dinosaurs had feathers",
      "vikings sailed far",
      "kings ruled kingdoms",
      "explorers discovered new lands",
    ];
    for (const s of inputs) {
      const out = asWhyQuestion(s);
      expect(
        /\bdoes\s+\w+(?:\s+\w+)?\s+(had|was|were|did|went|invented|discovered|evolved|created|built|used)\b/i.test(
          out,
        ),
      ).toBe(false);
    }
  });

  it("upgrades a present-tense -s verb to 'Why does ...'", () => {
    // subject 'dog' + verb 'barks' → "Why does dog bark loudly?"
    expect(asWhyQuestion("dog barks loudly")).toBe("Why does dog bark loudly?");
  });
});

describe("normalizeStoredQuestion", () => {
  it("strips leading 'why' and trailing punctuation for storage", () => {
    const r = normalizeStoredQuestion("Why is the sky blue?");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.question).toBe("is the sky blue");
  });

  it("collapses whitespace and lowercases only the first char", () => {
    const r = normalizeStoredQuestion("   Do  You  Know  Why   Rain Falls  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.question).toBe("rain Falls");
  });

  it("accepts a past-tense phrase and renders it grammatically", () => {
    const r = normalizeStoredQuestion("some dinosaurs had feathers");
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe("Why did some dinosaurs have feathers?");
  });

  it("rejects too-short questions", () => {
    const r = normalizeStoredQuestion("hi");
    expect(r.ok).toBe(false);
  });

  it("rejects renders that end up with 'does X had/was/were'", () => {
    // Simulate a bad candidate that would render awkwardly. This is a
    // safety net — asWhyQuestion should already avoid this shape.
    const bad = "does some dinosaur had feathers";
    const r = normalizeStoredQuestion(bad);
    expect(r.ok).toBe(false);
  });
});
