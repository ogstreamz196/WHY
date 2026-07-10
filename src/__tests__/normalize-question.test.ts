import { describe, it, expect } from "vitest";
import { asWhyQuestion } from "@/lib/whyQuestion";
import { normalizeStoredQuestion } from "@/lib/normalizeQuestion";

describe("asWhyQuestion — past tense handling", () => {
  const cases: Array<[string, string]> = [
    ["some dinosaurs had feathers", "Why some dinosaurs had feathers?"],
    ["romans built roads", "Why romans built roads?"],
    ["the pyramids were built by hand", "Why the pyramids were built by hand?"],
    ["mammoths went extinct", "Why mammoths went extinct?"],
    ["edison invented the bulb", "Why edison invented the bulb?"],
    ["humans evolved from apes", "Why humans evolved from apes?"],
    ["the dodo was flightless", "Why the dodo was flightless?"],
    ["ancient people used fire", "Why ancient people used fire?"],
  ];
  it.each(cases)("keeps past tense intact for %j", (input, expected) => {
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
      expect(/\bdoes\s+\w+(?:\s+\w+)?\s+(had|was|were|did|went|invented|discovered|evolved|created|built|used)\b/i.test(out)).toBe(false);
    }
  });

  it("still upgrades present-tense to 'Why does ...'", () => {
    expect(asWhyQuestion("cats purr when happy")).toBe("Why does cat purr when happy?");
    expect(asWhyQuestion("the sun shines")).toBe("Why does the sun shine?");
  });
});

describe("normalizeStoredQuestion", () => {
  it("strips leading 'why' and trailing punctuation for storage", () => {
    const r = normalizeStoredQuestion("Why is the sky blue?");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.question).toBe("is the sky blue");
  });

  it("collapses whitespace and lowercases first char", () => {
    const r = normalizeStoredQuestion("   Do  You  Know  Why   Rain Falls  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.question).toBe("rain falls");
  });

  it("accepts a past-tense phrase and renders it grammatically", () => {
    const r = normalizeStoredQuestion("some dinosaurs had feathers");
    expect(r.ok).toBe(true);
    expect(r.rendered).toBe("Why some dinosaurs had feathers?");
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
