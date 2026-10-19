// Who may use 18+ mode. Pure helpers shared by the server and tests.
//
// - 18+ mode is web only. The Android/iOS apps add a "WhyNativeApp" marker to
//   their user agent; anything carrying it is refused, on screen and on the
//   server.
// - Age comes from the birth month and year the player gave (at sign-up, or
//   once in Settings). It's kept in the account's app_metadata, which only the
//   server can write, and can't be changed afterwards.
import { NATIVE_UA_MARKER } from "./platform";

export const ADULT_AGE = 18;
/** Accounts are 13+ (see the sign-up age screen). */
export const MIN_ACCOUNT_AGE = 13;

export type BirthDate = { year: number; month: number };

/** Whole years of age on `now` for someone born in that month (1-12). */
export function ageFrom(b: BirthDate, now: Date = new Date()): number {
  let age = now.getFullYear() - b.year;
  if (now.getMonth() + 1 < b.month) age -= 1;
  return age;
}

/** A birth date that could be real: month 1-12, age 0-120. */
export function isPlausibleBirthDate(b: BirthDate, now: Date = new Date()): boolean {
  if (!Number.isInteger(b.year) || !Number.isInteger(b.month)) return false;
  if (b.month < 1 || b.month > 12) return false;
  const age = ageFrom(b, now);
  return age >= 0 && age <= 120;
}

/** The birth date saved on an account (app_metadata), if any. */
export function birthDateFromMeta(meta: unknown): BirthDate | null {
  if (!meta || typeof meta !== "object") return null;
  const m = meta as Record<string, unknown>;
  const year = Number(m.birth_year);
  const month = Number(m.birth_month);
  const b = { year, month };
  return isPlausibleBirthDate(b) ? b : null;
}

export function isAdultBirthDate(b: BirthDate | null, now: Date = new Date()): boolean {
  return !!b && ageFrom(b, now) >= ADULT_AGE;
}

export function isUnderAccountAge(b: BirthDate | null, now: Date = new Date()): boolean {
  return !!b && ageFrom(b, now) < MIN_ACCOUNT_AGE;
}

/** True for requests from the Android/iOS apps. */
export function isNativeUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(NATIVE_UA_MARKER);
}
