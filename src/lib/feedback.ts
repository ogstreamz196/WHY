/**
 * Lightweight audio + haptic feedback for quiz interactions.
 * - Sounds are synthesized with the Web Audio API (no assets to ship).
 * - Users can toggle sound and haptics independently via localStorage.
 * - All functions no-op safely on SSR and when disabled.
 */

export type FeedbackKind = "correct" | "wrong" | "reveal" | "tick";

const SOUND_KEY = "why:sfx-enabled";
const HAPTIC_KEY = "why:haptics-enabled";

function readFlag(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    return v === "1";
  } catch {
    return fallback;
  }
}

export function isSoundEnabled(): boolean {
  return readFlag(SOUND_KEY, true);
}

export function isHapticsEnabled(): boolean {
  return readFlag(HAPTIC_KEY, true);
}

export function setSoundEnabled(on: boolean) {
  try {
    window.localStorage.setItem(SOUND_KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("why:feedback-changed"));
  } catch {
    /* ignore */
  }
}

export function setHapticsEnabled(on: boolean) {
  try {
    window.localStorage.setItem(HAPTIC_KEY, on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("why:feedback-changed"));
  } catch {
    /* ignore */
  }
}

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AC: typeof AudioContext | undefined =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  if (!ctx) ctx = new AC();
  if (ctx.state === "suspended") void ctx.resume().catch(() => {});
  return ctx;
}

function tone(
  freq: number,
  durMs: number,
  {
    type = "sine",
    gain = 0.08,
    slideTo,
    delayMs = 0,
  }: {
    type?: OscillatorType;
    gain?: number;
    slideTo?: number;
    delayMs?: number;
  } = {},
) {
  const c = getCtx();
  if (!c) return;
  const t0 = c.currentTime + delayMs / 1000;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + durMs / 1000);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + durMs / 1000);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + durMs / 1000 + 0.02);
}

/** Play a short cue. Silently no-ops when disabled or unsupported. */
export function playSfx(kind: FeedbackKind) {
  if (!isSoundEnabled()) return;
  try {
    switch (kind) {
      case "correct":
        // Rising major triad
        tone(523.25, 140, { type: "triangle", gain: 0.09 });
        tone(659.25, 140, { type: "triangle", gain: 0.09, delayMs: 90 });
        tone(783.99, 220, { type: "triangle", gain: 0.1, delayMs: 180 });
        break;
      case "wrong":
        // Descending buzz
        tone(220, 220, { type: "sawtooth", gain: 0.06, slideTo: 110 });
        break;
      case "reveal":
        tone(392, 90, { type: "sine", gain: 0.06 });
        tone(587.33, 140, { type: "sine", gain: 0.07, delayMs: 70 });
        break;
      case "tick":
        tone(880, 40, { type: "square", gain: 0.03 });
        break;
    }
  } catch {
    /* ignore audio failures */
  }
}

/** Trigger vibration if enabled and supported. */
export function haptic(kind: FeedbackKind) {
  if (!isHapticsEnabled()) return;
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  try {
    switch (kind) {
      case "correct":
        navigator.vibrate?.([30, 40, 30]);
        break;
      case "wrong":
        navigator.vibrate?.(160);
        break;
      case "reveal":
        navigator.vibrate?.(20);
        break;
      case "tick":
        navigator.vibrate?.(8);
        break;
    }
  } catch {
    /* ignore */
  }
}

/** Convenience: fire both together. */
export function feedback(kind: FeedbackKind) {
  playSfx(kind);
  haptic(kind);
}
