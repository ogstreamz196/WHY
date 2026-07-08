export const CATEGORIES = [
  { key: "all", label: "All", emoji: "✨" },
  { key: "animals", label: "Animals", emoji: "🐘" },
  { key: "space", label: "Space", emoji: "🚀" },
  { key: "earth", label: "Earth", emoji: "🌍" },
  { key: "science", label: "Science", emoji: "🧪" },
  { key: "body", label: "Human Body", emoji: "🧠" },
  { key: "weather", label: "Weather", emoji: "🌦" },
  { key: "food", label: "Food", emoji: "🍕" },
  { key: "history", label: "History", emoji: "🏛" },
  { key: "technology", label: "Technology", emoji: "💻" },
  { key: "ocean", label: "Oceans", emoji: "🌊" },
  { key: "dinosaurs", label: "Dinosaurs", emoji: "🦖" },
] as const;

export type CategoryKey = (typeof CATEGORIES)[number]["key"];

export const emojiFor = (key?: string | null) =>
  CATEGORIES.find((c) => c.key === key)?.emoji ?? "✨";
