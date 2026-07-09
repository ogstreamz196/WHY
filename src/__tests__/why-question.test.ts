import { describe, it, expect } from "vitest";
import { asWhyQuestion } from "@/routes/index";

const variants = [
  ["do we have different blood types?", "Why do we have different blood types?"],
  ["Do you know why the sky is blue?", "Why the sky is blue?"],
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
});
