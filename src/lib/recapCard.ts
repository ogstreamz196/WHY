import { CATEGORIES } from "@/lib/categories";
import type { WeeklyRecap } from "@/lib/missions.functions";
import { SITE_URL } from "@/lib/site";

/** The lines on the share picture (kept separate so they can be tested). */
export function recapCardLines(
  recap: Pick<WeeklyRecap, "discoveries" | "current_streak" | "categories">,
) {
  const top = recap.categories[0];
  const topic = top ? CATEGORIES.find((c) => c.key === top.key) : undefined;
  return [
    `✨ ${recap.discoveries} ${recap.discoveries === 1 ? "fact" : "facts"} discovered`,
    `🔥 ${recap.current_streak}-day streak`,
    ...(topic ? [`${topic.emoji} Favourite topic: ${topic.label}`] : []),
  ];
}

/** Draws a 1080×1080 "My curiosity week" picture and returns it as a PNG. */
export async function drawRecapCard(
  recap: Pick<WeeklyRecap, "discoveries" | "current_streak" | "categories">,
): Promise<Blob | null> {
  const size = 1080;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, "#2a0f5c");
  bg.addColorStop(0.55, "#5b21b6");
  bg.addColorStop(1, "#db2777");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);

  // A few soft stars.
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  for (const [x, y, r] of [
    [140, 160, 6],
    [920, 220, 8],
    [820, 880, 5],
    [200, 860, 7],
    [560, 120, 4],
  ]) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.textAlign = "center";
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 72px system-ui, sans-serif";
  ctx.fillText("My curiosity week", size / 2, 260);

  ctx.font = "700 54px system-ui, sans-serif";
  recapCardLines(recap).forEach((line, i) => ctx.fillText(line, size / 2, 440 + i * 110));

  ctx.font = "800 48px system-ui, sans-serif";
  ctx.fillStyle = "#fde68a";
  ctx.fillText(`Why?  ·  ${SITE_URL.replace(/^https?:\/\//, "")}`, size / 2, 960);

  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}
