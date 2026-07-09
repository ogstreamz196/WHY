import { describe, it, expect } from "vitest";
import { WORDS_FOR, wordCount, trimToWords } from "@/lib/quiz.functions";

describe("quiz word-count helpers", () => {
  it("wordCount counts whitespace-separated tokens", () => {
    expect(wordCount("")).toBe(0);
    expect(wordCount("   ")).toBe(0);
    expect(wordCount("one")).toBe(1);
    expect(wordCount("  two words ")).toBe(2);
    expect(wordCount("a b c d e")).toBe(5);
  });

  it("trimToWords caps to n words and strips trailing punctuation", () => {
    expect(trimToWords("The quick brown fox jumps.", 3)).toBe("The quick brown");
    expect(trimToWords("Hello!", 4)).toBe("Hello");
    expect(trimToWords("  spaced  out  answer  ", 2)).toBe("spaced out");
  });

  it("trimToWords output never exceeds target for any difficulty", () => {
    const samples = [
      "A short answer",
      "This is a considerably longer reference answer with many words.",
      "One",
      "Two words",
      "Punctuated ending sentence!",
    ];
    for (const diff of Object.keys(WORDS_FOR) as Array<keyof typeof WORDS_FOR>) {
      const target = WORDS_FOR[diff];
      for (const s of samples) {
        const trimmed = trimToWords(s, target);
        expect(wordCount(trimmed)).toBeLessThanOrEqual(target);
      }
    }
  });

  it("WORDS_FOR increases with difficulty", () => {
    expect(WORDS_FOR.easy).toBeLessThan(WORDS_FOR.medium);
    expect(WORDS_FOR.medium).toBeLessThan(WORDS_FOR.hard);
    expect(WORDS_FOR.hard).toBeLessThan(WORDS_FOR.expert);
  });
});
