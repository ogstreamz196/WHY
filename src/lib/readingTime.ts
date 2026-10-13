/** Roughly how long a young reader needs: about 3 words a second, 5 to 15 seconds. */
export function readingTimeMs(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.min(15_000, Math.max(5_000, Math.round((words / 3) * 1000)));
}
