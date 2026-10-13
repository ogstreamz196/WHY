import { describe, it, expect } from "vitest";
import { asWhyQuestion } from "@/lib/whyQuestion";

const variants = [
  ["do we have different blood types?", "Why do we have different blood types?"],
  ["Do you know why the sky is blue?", "Why the sky is blue?"],
  ["Do you know why Do you know why the hagfish erupts slime that can choke a shark?", "Why the hagfish erupts slime that can choke a shark?"],
  ["DO YOU KNOW WHY do you know why why do cats purr??", "Why do cats purr?"],
  ["Why is the sky blue?", "Why is the sky blue?"],
  ["why why do cats purr", "Why do cats purr?"],
  ["WHY WHY WHY do we yawn?", "Why do we yawn?"],
  ["How come leaves change color", "How come leaves change color?"],
  ["What causes rainbows.", "What causes rainbows?"],
  ["the ocean is salty", "Why the ocean is salty?"],
  ["", ""],
];

describe("asWhyQuestion", () => {
  it.each(variants)("normalizes %j", (input, expected) => {
    expect(asWhyQuestion(input)).toBe(expected);
  });

  it("never produces duplicated leading 'why'", () => {
    const inputs = [
      "why do we sleep",
      "Why why why",
      "do you know why why we dream",
      "the sun is hot",
      "How come why",
      "WHY is grass green?",
    ];
    for (const s of inputs) {
      const out = asWhyQuestion(s).toLowerCase();
      expect(out.startsWith("why why")).toBe(false);
      // Only one leading 'why' token
      const leading = out.match(/^(why\s+)+/);
      if (leading) expect(leading[0].trim().split(/\s+/).length).toBe(1);
    }
  });

  it("random casing/punctuation variants never contain repeated 'why'", () => {
    const bases = [
      "do birds fly south",
      "we sneeze",
      "leaves fall in autumn",
      "the moon glows",
      "cats purr when happy",
    ];
    const prefixes = [
      "",
      "why ",
      "Why ",
      "WHY ",
      "why why ",
      "Why Why Why ",
      "wHy wHy ",
      "do you know why ",
      "Do You Know Why why ",
    ];
    const puncts = ["", "?", "!", ".", "??", "?!"];
    for (const base of bases) {
      for (const pre of prefixes) {
        for (const pun of puncts) {
          const input = `${pre}${base}${pun}`;
          const out = asWhyQuestion(input);
          const lower = out.toLowerCase();

          // No two consecutive "why" tokens anywhere in the string
          expect(/\bwhy\s+why\b/i.test(out)).toBe(false);

          // At most one "why" in the first two tokens
          const firstTwo = lower.split(/\s+/).slice(0, 2);
          const whyCount = firstTwo.filter((t) => t.replace(/[^a-z]/g, "") === "why").length;
          expect(whyCount).toBeLessThanOrEqual(1);

          // Ends in a single '?'
          expect(/\?$/.test(out)).toBe(true);
          expect(/[?!.]\?$/.test(out)).toBe(false);

          // Starts with a capital
          expect(/^[A-Z]/.test(out)).toBe(true);
        }
      }
    }
  });

  it("mid-sentence 'why' is preserved (not falsely flagged as duplicate)", () => {
    const out = asWhyQuestion("we ask why things happen");
    expect(out).toBe("Why we ask why things happen?");
    expect(/\bwhy\s+why\b/i.test(out)).toBe(false);
  });

  it("every output starts with 'Why' (or an allowed variant) and ends with exactly one '?'", () => {
    const inputs = [
      "the sky is blue",
      "do you know why the sky is blue",
      "Why is the sky blue!!",
      "How come leaves change color.",
      "what causes rainbows",
      "cats purr when happy?",
      "WHY do we sleep",
      "why why why do we dream",
    ];
    for (const s of inputs) {
      const out = asWhyQuestion(s);
      expect(/^(Why|How come|How|What makes|What causes)\b/.test(out)).toBe(true);
      // exactly one trailing '?' and no other trailing punctuation
      expect(out.endsWith("?")).toBe(true);
      expect(out.endsWith("??")).toBe(false);
      expect((out.match(/\?/g) ?? []).length).toBe(1);
    }
  });
});
