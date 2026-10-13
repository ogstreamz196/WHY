import { describe, expect, it } from "vitest";
import {
  ageFrom,
  birthDateFromMeta,
  isAdultBirthDate,
  isNativeUserAgent,
  isPlausibleBirthDate,
} from "./adultGate";

const NOW = new Date("2026-10-15T12:00:00Z");

describe("ageFrom", () => {
  it("counts a birthday month that hasn't come yet", () => {
    expect(ageFrom({ year: 2008, month: 10 }, NOW)).toBe(18);
    expect(ageFrom({ year: 2008, month: 11 }, NOW)).toBe(17);
  });
});

describe("isAdultBirthDate", () => {
  it("needs a saved birth date of 18 or more", () => {
    expect(isAdultBirthDate({ year: 2008, month: 10 }, NOW)).toBe(true);
    expect(isAdultBirthDate({ year: 2008, month: 12 }, NOW)).toBe(false);
    expect(isAdultBirthDate({ year: 2015, month: 1 }, NOW)).toBe(false);
    expect(isAdultBirthDate(null, NOW)).toBe(false);
  });
});

describe("birthDateFromMeta", () => {
  it("reads only real-looking dates", () => {
    expect(birthDateFromMeta({ birth_year: 1990, birth_month: 4 })).toEqual({
      year: 1990,
      month: 4,
    });
    expect(birthDateFromMeta({ birth_year: "1990", birth_month: "4" })).toEqual({
      year: 1990,
      month: 4,
    });
    expect(birthDateFromMeta({ birth_year: 1990, birth_month: 13 })).toBeNull();
    expect(birthDateFromMeta({ birth_year: 1800, birth_month: 1 })).toBeNull();
    expect(birthDateFromMeta({})).toBeNull();
    expect(birthDateFromMeta(null)).toBeNull();
  });

  it("rejects dates in the future", () => {
    expect(isPlausibleBirthDate({ year: 2030, month: 1 }, NOW)).toBe(false);
  });
});

describe("isNativeUserAgent", () => {
  it("spots the Android and iOS apps", () => {
    expect(isNativeUserAgent("Mozilla/5.0 (Linux; Android 14) Chrome/130 WhyNativeApp")).toBe(true);
    expect(isNativeUserAgent("Mozilla/5.0 (iPhone) Safari/604.1")).toBe(false);
    expect(isNativeUserAgent(null)).toBe(false);
  });
});
