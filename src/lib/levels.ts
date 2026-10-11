// Named curiosity level tiers. Pure client util — safe to import anywhere.

export type LevelTier = { min: number; level: number; title: string };

// Ascending by min XP. Any XP below the first threshold uses tier[0].
const TIERS: LevelTier[] = [
  { min: 0, level: 1, title: "Curious Mind" },
  { min: 50, level: 2, title: "Question Sprout" },
  { min: 150, level: 3, title: "Question Seeker" },
  { min: 350, level: 5, title: "Fact Finder" },
  { min: 600, level: 8, title: "Question Hunter" },
  { min: 1000, level: 12, title: "Knowledge Explorer" },
  { min: 1600, level: 18, title: "Curiosity Adept" },
  { min: 2500, level: 25, title: "Curiosity Expert" },
  { min: 4000, level: 35, title: "Wisdom Seeker" },
  { min: 6000, level: 50, title: "Infinite Thinker" },
  { min: 9000, level: 70, title: "Cosmic Scholar" },
  { min: 13000, level: 90, title: "Curiosity Champion" },
  { min: 20000, level: 100, title: "Legendary Explorer" },
];

export type LevelInfo = {
  level: number;
  title: string;
  min: number;
  next: LevelTier | null;
  xpIntoLevel: number;
  xpToNext: number | null;
  progressPct: number;
};

export function levelFor(xp: number): LevelInfo {
  const safeXp = Math.max(0, Math.floor(xp || 0));
  let current = TIERS[0];
  let next: LevelTier | null = null;
  for (let i = 0; i < TIERS.length; i++) {
    if (safeXp >= TIERS[i].min) {
      current = TIERS[i];
      next = TIERS[i + 1] ?? null;
    } else {
      break;
    }
  }
  const xpIntoLevel = safeXp - current.min;
  const xpToNext = next ? next.min - safeXp : null;
  const progressPct = next
    ? Math.min(100, Math.round((xpIntoLevel / (next.min - current.min)) * 100))
    : 100;
  return {
    level: current.level,
    title: current.title,
    min: current.min,
    next,
    xpIntoLevel,
    xpToNext,
    progressPct,
  };
}
