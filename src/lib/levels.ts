// Named curiosity level tiers. Pure client util — safe to import anywhere.

export type LevelTier = { min: number; level: number; title: string };

// Ascending by min XP. Any XP below the first threshold uses tier[0].
const TIERS: LevelTier[] = [
  { min: 0,    level: 1,  title: "Curious Mind" },
  { min: 100,  level: 2,  title: "Question Seeker" },
  { min: 300,  level: 5,  title: "Question Hunter" },
  { min: 800,  level: 10, title: "Knowledge Explorer" },
  { min: 2000, level: 25, title: "Curiosity Expert" },
  { min: 5000, level: 50, title: "Infinite Thinker" },
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
