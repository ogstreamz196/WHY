#!/usr/bin/env node
/**
 * Fun-font contrast/a11y check.
 *
 * Measures WCAG 2.1 contrast ratio for the fun-font foreground colors used
 * across the app against every "key" background surface token defined in
 * src/styles.css. Fails the build (exit 1) if any pair falls below
 * threshold.
 *
 * Thresholds:
 *   - Large fun text (>=18pt / 24px): 3.0:1  (WCAG AA large)
 *   - Body fun text  (<18pt):         4.5:1  (WCAG AA normal)
 *
 * Run: `node scripts/check-fun-contrast.mjs`
 */
import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const CSS_PATH = path.resolve(__dirname, "../src/styles.css");
const css = fs.readFileSync(CSS_PATH, "utf8");

/* ---------- color parsing ---------- */

// oklch(L C H) -> sRGB [0..1]
function oklchToRgb(L, C, hDeg) {
  const h = (hDeg * Math.PI) / 180;
  const a = Math.cos(h) * C;
  const b = Math.sin(h) * C;
  const l_ = L + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = L - 0.0894841775 * a - 1.291485548 * b;
  const l = l_ ** 3,
    m = m_ ** 3,
    s = s_ ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const clamp = (v) => Math.max(0, Math.min(1, v));
  return [clamp(r), clamp(g), clamp(bl)];
}

function parseColor(str) {
  const s = str.trim();
  let m = s.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*([\d.]+))?\s*\)$/);
  if (m) {
    const [, L, C, H, A] = m;
    const [r, g, b] = oklchToRgb(+L, +C, +H);
    return { r, g, b, a: A ? +A : 1 };
  }
  m = s.match(/^#([\da-f]{6})$/i);
  if (m) {
    const n = parseInt(m[1], 16);
    return { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255, a: 1 };
  }
  m = s.match(/^rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)(?:[\s,\/]+([\d.]+))?\s*\)$/);
  if (m) {
    return { r: +m[1] / 255, g: +m[2] / 255, b: +m[3] / 255, a: m[4] ? +m[4] : 1 };
  }
  throw new Error(`Unsupported color: ${str}`);
}

// Composite fg (with alpha) over opaque bg
function composite(fg, bg) {
  const a = fg.a;
  return {
    r: fg.r * a + bg.r * (1 - a),
    g: fg.g * a + bg.g * (1 - a),
    b: fg.b * a + bg.b * (1 - a),
    a: 1,
  };
}

function relLuminance({ r, g, b }) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}
function contrast(fg, bg) {
  const L1 = relLuminance(fg),
    L2 = relLuminance(bg);
  const [a, b] = L1 > L2 ? [L1, L2] : [L2, L1];
  return (a + 0.05) / (b + 0.05);
}

/* ---------- extract tokens from styles.css ---------- */

function tokensFromBlock(block) {
  const out = {};
  for (const [, k, v] of block.matchAll(/--([\w-]+):\s*([^;]+);/g)) out[k] = v.trim();
  return out;
}
function blockFor(selector) {
  const re = new RegExp(`${selector}\\s*\\{([\\s\\S]*?)\\}`, "m");
  const m = css.match(re);
  return m ? tokensFromBlock(m[1]) : {};
}

const THEMES = {
  "default (dark cosmic)": blockFor(":root"),
  "boss (silver/red)": blockFor("\\.theme-boss"),
};

/* ---------- test matrix ---------- */

// Fun-font foregrounds actually used in the app (see rg font-fun usage).
const FUN_FOREGROUNDS = [
  { name: "text-white", color: "#ffffff", size: "large" },
  { name: "text-white/95", color: "rgba(255,255,255,0.95)", size: "large" },
  { name: "text-white/85", color: "rgba(255,255,255,0.85)", size: "body" },
  { name: "text-white/80", color: "rgba(255,255,255,0.80)", size: "body" },
  { name: "text-yellow-100", color: "#fef9c3", size: "body" }, // fun-fact
];

// Background surfaces the fun text lands on. We test the darkest sample
// (worst case for white text) — the app never places white fun text on a
// light surface.
const SURFACE_KEYS = ["background", "cosmos", "nebula"];

const THRESHOLDS = { large: 3.0, body: 4.5 };

/* ---------- run ---------- */

const failures = [];
const rows = [];

for (const [themeName, tokens] of Object.entries(THEMES)) {
  for (const surface of SURFACE_KEYS) {
    if (!tokens[surface]) continue;
    const bg = parseColor(tokens[surface]);
    for (const fg of FUN_FOREGROUNDS) {
      const solidFg = composite(parseColor(fg.color), bg);
      const ratio = contrast(solidFg, bg);
      const min = THRESHOLDS[fg.size];
      const pass = ratio >= min;
      rows.push({
        theme: themeName,
        surface,
        fg: fg.name,
        size: fg.size,
        ratio: ratio.toFixed(2),
        min,
        pass,
      });
      if (!pass)
        failures.push({ theme: themeName, surface, fg: fg.name, ratio: ratio.toFixed(2), min });
    }
  }
}

const pad = (s, n) => String(s).padEnd(n);
console.log("\nFun-font contrast audit\n");
console.log(
  pad("theme", 22),
  pad("surface", 12),
  pad("fg", 20),
  pad("size", 6),
  pad("ratio", 7),
  pad("min", 5),
  "result",
);
console.log("-".repeat(84));
for (const r of rows) {
  console.log(
    pad(r.theme, 22),
    pad(r.surface, 12),
    pad(r.fg, 20),
    pad(r.size, 6),
    pad(r.ratio + ":1", 7),
    pad(r.min + ":1", 5),
    r.pass ? "PASS" : "FAIL",
  );
}

if (failures.length) {
  console.error(
    `\n${failures.length} fun-font contrast failure(s). Adjust foreground opacity, tint, or the .font-fun text-shadow halo in src/styles.css.`,
  );
  process.exit(1);
}
console.log(`\nAll ${rows.length} fun-font pairs meet WCAG AA thresholds.`);
