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

// ------- Curiosity points + streak (tied to Daily Challenge) -------
const KEY_DAILY_DONE = "why:dailyDone"; // last date the daily challenge was completed
const DAILY_POINTS = 25;

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

/**
 * Deprecated: kept for compatibility. Streaks now advance only when the
 * user completes the Daily Challenge. See `completeDailyChallenge`.
 */
export function touchStreak(): { streak: number; isNewDay: boolean } {
  return { streak: getStreak(), isNewDay: false };
}

export const getStreak = () => read<number>(KEY_STREAK, 0);

export const hasCompletedDailyChallenge = (): boolean =>
  read<string>(KEY_DAILY_DONE, "") === todayKey();

/**
 * Called when the user views/reveals the Daily Challenge fact.
 * - First completion of the day: awards +25 points, advances streak
 *   (or resets to 1 if a day was missed).
 * - Later completions the same day: no-op.
 */
export function completeDailyChallenge(): {
  awarded: boolean;
  streak: number;
  points: number;
  pointsDelta: number;
} {
  const today = todayKey();
  const last = read<string>(KEY_DAILY_DONE, "");
  if (last === today) {
    return { awarded: false, streak: getStreak(), points: getPoints(), pointsDelta: 0 };
  }
  const prevStreak = read<number>(KEY_STREAK, 0);
  const nextStreak = last === yesterdayKey() ? prevStreak + 1 : 1;
  write(KEY_STREAK, nextStreak);
  write(KEY_DAILY_DONE, today);
  write(KEY_LAST_DAY, today);
  const newPoints = addPoints(DAILY_POINTS);
  return { awarded: true, streak: nextStreak, points: newPoints, pointsDelta: DAILY_POINTS };
}


// ------- Seen count (for "next generation cadence") -------
export const bumpSeen = () => {
  const n = read<number>(KEY_SEEN, 0) + 1;
  write(KEY_SEEN, n);
  return n;
};
export const getSeen = () => read<number>(KEY_SEEN, 0);

// ------- Seen fact IDs (dedupe: never show the same fact twice) -------
const KEY_SEEN_IDS = "why:seenIds";
const SEEN_IDS_MAX = 5000;
export const getSeenIds = (): string[] => read<string[]>(KEY_SEEN_IDS, []);
export function markSeen(id: string): void {
  if (!id) return;
  const list = read<string[]>(KEY_SEEN_IDS, []);
  if (list.includes(id)) return;
  list.push(id);
  // Keep a rolling window so localStorage never grows unbounded.
  write(KEY_SEEN_IDS, list.length > SEEN_IDS_MAX ? list.slice(-SEEN_IDS_MAX) : list);
}
export const resetSeenIds = () => write(KEY_SEEN_IDS, []);

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
    // Discovery ladder
    { id: "curious",    label: "Curious",         emoji: "🌱", unlocked: seen >= 5 },
    { id: "explorer",   label: "Explorer",        emoji: "🧭", unlocked: seen >= 25 },
    { id: "scientist",  label: "Scientist",       emoji: "🔬", unlocked: seen >= 100 },
    { id: "sage",       label: "Sage",            emoji: "📚", unlocked: seen >= 250 },
    { id: "polymath",   label: "Polymath",        emoji: "🧠", unlocked: seen >= 500 },
    { id: "oracle",     label: "Oracle",          emoji: "🔮", unlocked: seen >= 1000 },
    // Streak ladder
    { id: "streak3",    label: "3-day streak",    emoji: "🔥", unlocked: streak >= 3 },
    { id: "streak7",    label: "Week of Why",     emoji: "📅", unlocked: streak >= 7 },
    { id: "streak14",   label: "Fortnight Flame", emoji: "🌟", unlocked: streak >= 14 },
    { id: "streak30",   label: "Monthly Master",  emoji: "🏆", unlocked: streak >= 30 },
    { id: "streak60",   label: "Curiosity Comet", emoji: "☄️", unlocked: streak >= 60 },
    { id: "streak100",  label: "Century Champ",   emoji: "👑", unlocked: streak >= 100 },
    // Point ladder
    { id: "points100",  label: "100 points",      emoji: "⭐", unlocked: points >= 100 },
    { id: "points500",  label: "500 points",      emoji: "✨", unlocked: points >= 500 },
    { id: "points1k",   label: "1,000 points",    emoji: "💫", unlocked: points >= 1000 },
    { id: "points5k",   label: "5,000 points",    emoji: "🌠", unlocked: points >= 5000 },
    { id: "points10k",  label: "10,000 points",   emoji: "🚀", unlocked: points >= 10000 },
    { id: "points25k",  label: "25,000 points",   emoji: "🪐", unlocked: points >= 25000 },
  ];
}


// ------- Store / Y-Coin economy -------
// Note: "curiosity points" == Y-coins. Same underlying counter (KEY_POINTS)
// so nothing existing breaks. The UI just presents them as coins with a Y.

const KEY_INVENTORY = "why:inventory"; // array of owned item ids
const KEY_EQUIPPED = "why:equipped";   // { avatar?: id, theme?: id }

export type StoreCategory = "avatar" | "theme" | "boost";
export type StoreItem = {
  id: string;
  category: StoreCategory;
  name: string;
  emoji: string;
  description: string;
  cost: number;         // in Y-coins
  gradient?: string;    // CSS gradient for preview / theme application
};

export const STORE_CATALOG: StoreItem[] = [
  // Avatars
  { id: "avatar-sprout",   category: "avatar", name: "Sprout",     emoji: "🌱", description: "The starter — free for every explorer.", cost: 0 },
  { id: "avatar-owl",      category: "avatar", name: "Wise Owl",   emoji: "🦉", description: "For those who ask the deepest whys.",     cost: 50 },
  { id: "avatar-astro",    category: "avatar", name: "Astronaut",  emoji: "🧑‍🚀", description: "Explore the cosmos of curiosity.",       cost: 120 },
  { id: "avatar-dino",     category: "avatar", name: "Tiny Rex",   emoji: "🦖", description: "Ancient curiosity — never extinct.",     cost: 200 },
  { id: "avatar-wizard",   category: "avatar", name: "Why-zard",   emoji: "🧙", description: "Master of every curious spell.",         cost: 350 },
  { id: "avatar-unicorn",  category: "avatar", name: "Unicorn",    emoji: "🦄", description: "Rare, magical, one of a kind.",          cost: 500 },

  // Themes
  { id: "theme-cosmos",   category: "theme", name: "Cosmos",     emoji: "🌌", description: "The signature deep-space look.", cost: 0,
    gradient: "linear-gradient(135deg, oklch(0.30 0.12 280), oklch(0.28 0.15 320))" },
  { id: "theme-sunset",   category: "theme", name: "Sunset",     emoji: "🌇", description: "Warm oranges and pinks.",        cost: 80,
    gradient: "linear-gradient(135deg, #ff7e5f, #feb47b)" },
  { id: "theme-ocean",    category: "theme", name: "Ocean",      emoji: "🌊", description: "Calm blues and teals.",          cost: 150,
    gradient: "linear-gradient(135deg, #43cea2, #185a9d)" },
  { id: "theme-forest",   category: "theme", name: "Forest",     emoji: "🌲", description: "Deep greens and mossy calm.",    cost: 220,
    gradient: "linear-gradient(135deg, #134e5e, #71b280)" },
  { id: "theme-candy",    category: "theme", name: "Candy",      emoji: "🍭", description: "Playful pinks and violets.",     cost: 300,
    gradient: "linear-gradient(135deg, #ff9a9e, #fad0c4)" },
];

// Free items every user owns automatically.
const FREE_ITEMS = STORE_CATALOG.filter((i) => i.cost === 0).map((i) => i.id);

export const getInventory = (): string[] => {
  const owned = read<string[]>(KEY_INVENTORY, []);
  return Array.from(new Set([...FREE_ITEMS, ...owned]));
};
export const ownsItem = (id: string) => getInventory().includes(id);

export type Equipped = { avatar?: string; theme?: string };
const defaultEquipped: Equipped = { avatar: "avatar-sprout", theme: "theme-cosmos" };
export const getEquipped = (): Equipped => ({ ...defaultEquipped, ...read<Equipped>(KEY_EQUIPPED, {}) });
export const setEquipped = (patch: Equipped) => {
  const next = { ...getEquipped(), ...patch };
  write(KEY_EQUIPPED, next);
  return next;
};

export type PurchaseResult =
  | { ok: true; item: StoreItem; coinsLeft: number }
  | { ok: false; reason: "insufficient_coins" | "already_owned" | "not_found" };

export function purchaseItem(id: string): PurchaseResult {
  const item = STORE_CATALOG.find((i) => i.id === id);
  if (!item) return { ok: false, reason: "not_found" };
  if (ownsItem(id)) return { ok: false, reason: "already_owned" };
  const balance = getPoints();
  if (balance < item.cost) return { ok: false, reason: "insufficient_coins" };

  // Debit coins.
  const remaining = Math.max(0, balance - item.cost);
  write(KEY_POINTS, remaining);

  // Add to inventory.
  const owned = read<string[]>(KEY_INVENTORY, []);
  write(KEY_INVENTORY, Array.from(new Set([...owned, id])));

  // Auto-equip on purchase for a satisfying feel.
  if (item.category === "avatar" || item.category === "theme") {
    setEquipped({ [item.category]: id } as Equipped);
  }
  return { ok: true, item, coinsLeft: remaining };
}

// Coin packs available for purchase with real money (Stripe wiring later).
export type CoinPack = { id: string; coins: number; priceUSD: number; bonus?: number; label: string };
export const COIN_PACKS: CoinPack[] = [
  { id: "pack-starter", coins: 100,  priceUSD: 0.99, label: "Starter Pouch" },
  { id: "pack-plus",    coins: 550,  priceUSD: 4.99, bonus: 50,  label: "Explorer Pack" },
  { id: "pack-mega",    coins: 1200, priceUSD: 9.99, bonus: 200, label: "Cosmic Chest" },
];

// ------- Achievements (future-ready structure) -------
// Grouped: streak milestones, coin/level milestones, unlocked cosmetics.
// All derived from existing state so no new persistence is needed.

export type Achievement = {
  id: string;
  group: "streak" | "coins" | "collector";
  name: string;
  description: string;
  emoji: string;
  unlocked: boolean;
  /** 0..1 progress toward the next tier when locked (undefined when unlocked or terminal). */
  progress?: number;
  /** Human-readable next-goal hint when locked. */
  hint?: string;
};

const STREAK_TIERS = [3, 7, 14, 30, 60, 100];
const COIN_TIERS = [50, 250, 500, 1_000, 2_500, 5_000];

export function getAchievements(): Achievement[] {
  const streak = getStreak();
  const coins = getPoints();
  const inventory = getInventory();

  const list: Achievement[] = [];

  for (const tier of STREAK_TIERS) {
    const unlocked = streak >= tier;
    list.push({
      id: `streak-${tier}`,
      group: "streak",
      name: `${tier}-day streak`,
      description: `Complete the Daily Challenge ${tier} days in a row.`,
      emoji: tier >= 30 ? "🏆" : tier >= 7 ? "📅" : "🔥",
      unlocked,
      progress: unlocked ? undefined : Math.min(1, streak / tier),
      hint: unlocked ? undefined : `${streak}/${tier} days`,
    });
  }

  for (const tier of COIN_TIERS) {
    const unlocked = coins >= tier;
    list.push({
      id: `coins-${tier}`,
      group: "coins",
      name: `${tier.toLocaleString()} Y-coins`,
      description: `Earn ${tier.toLocaleString()} curiosity coins.`,
      emoji: tier >= 1000 ? "💎" : "🪙",
      unlocked,
      progress: unlocked ? undefined : Math.min(1, coins / tier),
      hint: unlocked ? undefined : `${coins}/${tier}`,
    });
  }

  // Collector: own N cosmetics (avatars + themes).
  const ownedCosmetics = inventory.filter((id) => id.startsWith("avatar-") || id.startsWith("theme-")).length;
  for (const tier of [3, 6, 10]) {
    const unlocked = ownedCosmetics >= tier;
    list.push({
      id: `collector-${tier}`,
      group: "collector",
      name: `Collector ×${tier}`,
      description: `Own ${tier} avatars or themes.`,
      emoji: "🎒",
      unlocked,
      progress: unlocked ? undefined : Math.min(1, ownedCosmetics / tier),
      hint: unlocked ? undefined : `${ownedCosmetics}/${tier}`,
    });
  }

  return list;
}

