import { useEffect, useState } from "react";
import { Volume2, VolumeX, Vibrate } from "lucide-react";
import {
  isHapticsEnabled,
  isSoundEnabled,
  setHapticsEnabled,
  setSoundEnabled,
  playSfx,
  haptic,
} from "@/lib/feedback";

/**
 * Compact accessible toggles for sound and haptics.
 * Renders as two icon buttons with clear aria-pressed state.
 */
export function FeedbackToggles({ className = "" }: { className?: string }) {
  const [sound, setSound] = useState(true);
  const [haptics, setHaptics] = useState(true);
  const [supportsVibrate, setSupportsVibrate] = useState(false);

  useEffect(() => {
    setSound(isSoundEnabled());
    setHaptics(isHapticsEnabled());
    setSupportsVibrate(typeof navigator !== "undefined" && "vibrate" in navigator);
    const onChange = () => {
      setSound(isSoundEnabled());
      setHaptics(isHapticsEnabled());
    };
    window.addEventListener("why:feedback-changed", onChange);
    return () => window.removeEventListener("why:feedback-changed", onChange);
  }, []);

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => {
          const next = !sound;
          setSoundEnabled(next);
          setSound(next);
          if (next) playSfx("reveal");
        }}
        aria-pressed={sound}
        aria-label={sound ? "Mute sound effects" : "Enable sound effects"}
        title={sound ? "Mute sounds" : "Enable sounds"}
        className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] text-white/80 transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        {sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
      </button>
      {supportsVibrate && (
        <button
          type="button"
          onClick={() => {
            const next = !haptics;
            setHapticsEnabled(next);
            setHaptics(next);
            if (next) haptic("reveal");
          }}
          aria-pressed={haptics}
          aria-label={haptics ? "Disable vibration" : "Enable vibration"}
          title={haptics ? "Disable vibration" : "Enable vibration"}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-white/[0.05] transition hover:bg-white/[0.1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 ${
            haptics ? "text-white/90" : "text-white/40"
          }`}
        >
          <Vibrate className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
