import { useEffect, useCallback } from "react";
import { getEquipped, themeGradientFor } from "@/lib/store";

/**
 * Applies the currently equipped theme's gradient as CSS custom properties
 * on <html>. Reacts to `why:equipped-change` events dispatched by
 * `setEquipped`, so changes take effect immediately without a refresh.
 * Persistence itself is handled by `setEquipped` writing to sessionStorage.
 *
 * Also exposes a `previewTheme(themeId | null)` callback that temporarily
 * overrides the visible theme (for hover / focus in the store) without
 * mutating the equipped selection.
 */
export function useEquippedTheme() {
  const applyEquipped = useCallback(() => {
    if (typeof document === "undefined") return;
    const { theme } = getEquipped();
    const gradient = themeGradientFor(theme);
    const root = document.documentElement;
    if (gradient) {
      root.style.setProperty("--theme-gradient", gradient);
      root.setAttribute("data-theme", theme ?? "");
    } else {
      root.style.removeProperty("--theme-gradient");
      root.removeAttribute("data-theme");
    }
  }, []);

  useEffect(() => {
    applyEquipped();
    const onChange = () => applyEquipped();
    window.addEventListener("why:equipped-change", onChange as EventListener);
    // Cross-tab / storage sync
    window.addEventListener("storage", onChange);
    // Re-apply when tab regains focus (covers SPA nav edge cases)
    window.addEventListener("focus", onChange);
    return () => {
      window.removeEventListener("why:equipped-change", onChange as EventListener);
      window.removeEventListener("storage", onChange);
      window.removeEventListener("focus", onChange);
    };
  }, [applyEquipped]);
}

/**
 * Temporarily preview a theme by writing its gradient to the CSS variable.
 * Pass `null` to clear the preview and restore the equipped theme.
 */
export function previewTheme(themeId: string | null) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (!themeId) {
    // Restore equipped
    const { theme } = getEquipped();
    const gradient = themeGradientFor(theme);
    if (gradient) {
      root.style.setProperty("--theme-gradient", gradient);
      root.setAttribute("data-theme", theme ?? "");
    } else {
      root.style.removeProperty("--theme-gradient");
      root.removeAttribute("data-theme");
    }
    return;
  }
  const gradient = themeGradientFor(themeId);
  if (gradient) {
    root.style.setProperty("--theme-gradient", gradient);
    root.setAttribute("data-theme", themeId);
  }
}
