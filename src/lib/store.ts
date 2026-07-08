// Client-side persistent state: favorites, curiosity points, streak, offline cache.
// No user accounts yet — everything lives in localStorage. Designed to migrate
// cleanly to per-user server storage later.

import type { Fact } from "@/lib/facts.functions";

const KEY_FAV = "why:favorites";
const KEY_POINTS = "why:points";
const KEY_STREAK = "why:streak";
const KEY_LAST_DAY = "why:lastDay";
const KEY_CACHE = "why:cache";
const KEY_SETTINGS = "why:settings";
const KEY_SEEN = "why:seenCount";

const CACHE_MAX = 40;

const isBrowser = () => typeof window !== "undefined";

function read<T>(key: string, fallback: T): T {
  if (!isBrowser()) return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (!v) return fallback;
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}
function write<T>(key: string, value: T) {
  if (!isBrowser()) return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota — ignore */
  }
}

// ------- Settings -------
export type Settings = {
  childMode: boolean;
  darkMode: boolean;
  sound: boolean;
  readingLevel: "easy" | "standard";
};
export const defaultSettings: Settings = {
  childMode: true,
  darkMode: false,
  sound: true,
  readingLevel: "standard",
};
export const getSettings = (): Settings => ({ ...defaultSettings, ...read(KEY_SETTINGS, {}) });
export const setSettings = (s: Settings) => write(KEY_SETTINGS, s);

// ------- Favorites -------
export const getFavorites = (): Fact[] => read<Fact[]>(KEY_FAV, []);
export const isFavorite = (id: string) => getFavorites().some((f) => f.id === id);
export function toggleFavorite(fact: Fact): boolean {
  const list = getFavorites();
  const idx = list.findIndex((f) => f.id === fact.id);
  if (idx >= 0) {
    list.splice(idx, 1);
    write(KEY_FAV, list);
    return false;
  }
  list.unshift(fact);
  write(KEY_FAV, list.slice(0, 200));
  return true;
}

// ------- Curiosity points + streak -------
export const getPoints = () => read<number>(KEY_POINTS, 0);
export const addPoints = (delta: number) => {
  const next = Math.max(0, getPoints() + delta);
  write(KEY_POINTS, next);
  return next;
};

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
export function touchStreak(): { streak: number; isNewDay: boolean } {
  const last = read<string>(KEY_LAST_DAY, "");
  const today = todayKey();
  let streak = read<number>(KEY_STREAK, 0);
  let isNewDay = false;
  if (last !== today) {
    isNewDay = true;
    streak = last === yesterdayKey() ? streak + 1 : 1;
    write(KEY_STREAK, streak);
    write(KEY_LAST_DAY, today);
  }
  return { streak, isNewDay };
}
export const getStreak = () => read<number>(KEY_STREAK, 0);

// ------- Seen count (for "next generation cadence") -------
export const bumpSeen = () => {
  const n = read<number>(KEY_SEEN, 0) + 1;
  write(KEY_SEEN, n);
  return n;
};
export const getSeen = () => read<number>(KEY_SEEN, 0);

// ------- Offline cache (last N facts) -------
export const cacheFact = (fact: Fact) => {
  const list = read<Fact[]>(KEY_CACHE, []);
  const without = list.filter((f) => f.id !== fact.id);
  without.unshift(fact);
  write(KEY_CACHE, without.slice(0, CACHE_MAX));
};
export const getCachedRandomFact = (excludeId?: string): Fact | null => {
  const list = read<Fact[]>(KEY_CACHE, []);
  const pool = excludeId ? list.filter((f) => f.id !== excludeId) : list;
  if (pool.length === 0) return list[0] ?? null;
  return pool[Math.floor(Math.random() * pool.length)];
};

// ------- Badges (simple thresholds) -------
export type Badge = { id: string; label: string; emoji: string; unlocked: boolean };
export function getBadges(): Badge[] {
  const points = getPoints();
  const streak = getStreak();
  const seen = getSeen();
  return [
    { id: "curious", label: "Curious", emoji: "🌱", unlocked: seen >= 5 },
    { id: "explorer", label: "Explorer", emoji: "🧭", unlocked: seen >= 25 },
    { id: "scientist", label: "Scientist", emoji: "🔬", unlocked: seen >= 100 },
    { id: "streak3", label: "3-day streak", emoji: "🔥", unlocked: streak >= 3 },
    { id: "streak7", label: "Week of Why", emoji: "📅", unlocked: streak >= 7 },
    { id: "points100", label: "100 points", emoji: "⭐", unlocked: points >= 100 },
  ];
}
