export type CategoryKey =
  | "all"
  | "animals"
  | "space"
  | "earth"
  | "science"
  | "body"
  | "weather"
  | "food"
  | "history"
  | "technology"
  | "ocean"
  | "dinosaurs";

export type Category = {
  key: CategoryKey;
  label: string;
  emoji: string;
  /** CSS gradient string used for bubble + card accents */
  gradient: string;
  /** Short accent color token for text/glow */
  glow: string;
};

export const CATEGORIES: Category[] = [
  {
    key: "all",
    label: "All",
    emoji: "✨",
    gradient: "linear-gradient(135deg, oklch(0.72 0.22 305), oklch(0.72 0.24 340))",
    glow: "var(--glow)",
  },
  {
    key: "animals",
    label: "Animals",
    emoji: "🐾",
    gradient: "linear-gradient(135deg, oklch(0.72 0.20 145), oklch(0.75 0.18 175))",
    glow: "var(--leaf)",
  },
  {
    key: "space",
    label: "Space",
    emoji: "🚀",
    gradient: "linear-gradient(135deg, oklch(0.65 0.22 275), oklch(0.72 0.24 305))",
    glow: "var(--glow)",
  },
  {
    key: "earth",
    label: "Earth",
    emoji: "🌍",
    gradient: "linear-gradient(135deg, oklch(0.70 0.16 230), oklch(0.75 0.18 190))",
    glow: "var(--ocean)",
  },
  {
    key: "science",
    label: "Science",
    emoji: "🧪",
    gradient: "linear-gradient(135deg, oklch(0.72 0.22 195), oklch(0.72 0.20 155))",
    glow: "var(--aurora)",
  },
  {
    key: "body",
    label: "Body",
    emoji: "🧠",
    gradient: "linear-gradient(135deg, oklch(0.72 0.24 340), oklch(0.78 0.18 15))",
    glow: "var(--magic)",
  },
  {
    key: "weather",
    label: "Weather",
    emoji: "🌦",
    gradient: "linear-gradient(135deg, oklch(0.75 0.14 220), oklch(0.85 0.10 250))",
    glow: "var(--ocean)",
  },
  {
    key: "food",
    label: "Food",
    emoji: "🍕",
    gradient: "linear-gradient(135deg, oklch(0.78 0.20 40),  oklch(0.75 0.22 20))",
    glow: "var(--flame)",
  },
  {
    key: "history",
    label: "History",
    emoji: "🏛",
    gradient: "linear-gradient(135deg, oklch(0.72 0.16 65),  oklch(0.68 0.15 50))",
    glow: "var(--star)",
  },
  {
    key: "technology",
    label: "Tech",
    emoji: "💻",
    gradient: "linear-gradient(135deg, oklch(0.60 0.15 270), oklch(0.70 0.20 300))",
    glow: "var(--glow)",
  },
  {
    key: "ocean",
    label: "Oceans",
    emoji: "🌊",
    gradient: "linear-gradient(135deg, oklch(0.65 0.16 215), oklch(0.72 0.20 245))",
    glow: "var(--ocean)",
  },
  {
    key: "dinosaurs",
    label: "Dinos",
    emoji: "🦖",
    gradient: "linear-gradient(135deg, oklch(0.68 0.18 145), oklch(0.72 0.20 100))",
    glow: "var(--leaf)",
  },
];

export const emojiFor = (key?: string | null) =>
  CATEGORIES.find((c) => c.key === key)?.emoji ?? "✨";

export const gradientFor = (key?: string | null) =>
  CATEGORIES.find((c) => c.key === key)?.gradient ?? CATEGORIES[0].gradient;
