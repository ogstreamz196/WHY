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

import { sanitizeQuizRow } from "@/lib/quiz.functions";

describe("sanitizeQuizRow", () => {
  it("returns null when correct_answer resolves to empty", () => {
    expect(
      sanitizeQuizRow({
        correct_answer: "",
        distractors: ["a b", "c d", "e f"],
        difficulty: "medium",
        fallbackAnswer: "",
      }),
    ).toBeNull();
  });

  it("caps correct_answer and distractors to the difficulty word budget", () => {
    const out = sanitizeQuizRow({
      correct_answer: "the moon orbits the planet earth",
      distractors: [
        "a really long wrong option here",
        "second incorrect option about space",
        "third clearly wrong choice text",
      ],
      difficulty: "medium", // 4 words
      fallbackAnswer: "the moon orbits earth",
    })!;
    expect(out).not.toBeNull();
    expect(wordCount(out.correct_answer)).toBeLessThanOrEqual(WORDS_FOR.medium);
    expect(out.distractors).toHaveLength(3);
    for (const d of out.distractors) {
      expect(wordCount(d)).toBeLessThanOrEqual(WORDS_FOR.medium);
    }
  });

  it("rejects when fewer than 3 unique distractors remain after dedupe", () => {
    const out = sanitizeQuizRow({
      correct_answer: "hello world",
      distractors: ["hello world", "Hello World", "hello world"],
      difficulty: "easy",
      fallbackAnswer: "hello world",
    });
    expect(out).toBeNull();
  });

  it("never lets a distractor equal the correct answer", () => {
    const out = sanitizeQuizRow({
      correct_answer: "blue whale",
      distractors: ["Blue Whale", "orca pod", "great white", "sperm whale"],
      difficulty: "easy",
      fallbackAnswer: "blue whale",
    })!;
    expect(out).not.toBeNull();
    for (const d of out.distractors) {
      expect(d.toLowerCase()).not.toBe(out.correct_answer.toLowerCase());
    }
  });

  it("truncates explanation to 300 chars", () => {
    const long = "x".repeat(500);
    const out = sanitizeQuizRow({
      correct_answer: "one two",
      distractors: ["a b", "c d", "e f"],
      explanation: long,
      difficulty: "easy",
      fallbackAnswer: "one two",
    })!;
    expect(out.explanation.length).toBeLessThanOrEqual(300);
  });
});
