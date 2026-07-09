import { useEffect, useState } from "react";

const TOKENS = [
  "--background",
  "--foreground",
  "--primary",
  "--ring",
  "--border",
  "--glow",
  "--nebula",
  "--cosmos",
  "--aurora",
  "--flame",
  "--star",
  "--magic",
];

const HIGHLIGHT_STYLE_ID = "theme-debugger-highlight";

function readTokens() {
  const cs = getComputedStyle(document.documentElement);
  return TOKENS.map((name) => ({ name, value: cs.getPropertyValue(name).trim() }));
}

function toggleHighlight(on: boolean) {
  const existing = document.getElementById(HIGHLIGHT_STYLE_ID);
  if (!on) {
    existing?.remove();
    return;
  }
  const css = `
    .glass, .glass-strong {
      outline: 2px dashed color-mix(in oklab, var(--glow) 90%, transparent) !important;
      outline-offset: 2px;
    }
    :where(a, button, [role="button"], input, select, textarea):focus-visible {
      outline: 3px solid color-mix(in oklab, var(--ring) 100%, transparent) !important;
    }
    [data-theme-debug-badge]::after {
      content: attr(data-theme-debug-badge);
      position: absolute; top: -8px; left: 8px;
      font: 700 9px/1 ui-monospace, monospace;
      padding: 2px 5px; border-radius: 4px;
      background: var(--ring); color: var(--background);
    }
  `;
  const style = existing ?? document.createElement("style");
  style.id = HIGHLIGHT_STYLE_ID;
  style.textContent = css;
  if (!existing) document.head.appendChild(style);
}

function isSwatch(v: string) {
  return /oklch|rgb|hsl|#/.test(v);
}

export function ThemeDebugger() {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);
  const [tokens, setTokens] = useState<{ name: string; value: string }[]>([]);
  const [highlight, setHighlight] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const enabled =
      localStorage.getItem("theme-debugger") === "1" ||
      new URLSearchParams(window.location.search).has("debug");
    setOpen(enabled);

    const onKey = (e: KeyboardEvent) => {
      if (e.altKey && e.shiftKey && e.key.toLowerCase() === "d") {
        const next = !open;
        setOpen(next);
        localStorage.setItem("theme-debugger", next ? "1" : "0");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (!open) {
      toggleHighlight(false);
      return;
    }
    const refresh = () => setTokens(readTokens());
    refresh();
    const obs = new MutationObserver(refresh);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme"],
    });
    return () => obs.disconnect();
  }, [open]);

  useEffect(() => {
    toggleHighlight(open && highlight);
  }, [open, highlight]);

  if (!open) return null;

  return (
    <div
      data-no-chrome
      className="fixed bottom-24 right-3 z-[9999] max-w-[280px] rounded-xl border border-white/10 bg-black/85 p-2 font-mono text-[11px] text-white shadow-2xl backdrop-blur"
      style={{ boxShadow: "0 0 0 1px var(--ring), 0 10px 30px rgba(0,0,0,.5)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <button
          data-no-chrome
          onClick={() => setCollapsed((c) => !c)}
          className="rounded px-1 text-[10px] font-bold tracking-wider text-white/90 hover:bg-white/10"
          aria-expanded={!collapsed}
        >
          🎨 THEME {collapsed ? "▸" : "▾"}
        </button>
        <div className="flex items-center gap-1">
          <label className="flex items-center gap-1 text-[10px] text-white/80">
            <input
              type="checkbox"
              checked={highlight}
              onChange={(e) => setHighlight(e.target.checked)}
            />
            highlight
          </label>
          <button
            data-no-chrome
            aria-label="Close debugger"
            onClick={() => {
              setOpen(false);
              localStorage.setItem("theme-debugger", "0");
            }}
            className="rounded px-1 text-white/70 hover:bg-white/10"
          >
            ×
          </button>
        </div>
      </div>
      {!collapsed && (
        <ul className="mt-2 max-h-[50vh] space-y-0.5 overflow-auto">
          {tokens.map((t) => (
            <li key={t.name} className="flex items-center gap-2">
              {isSwatch(t.value) ? (
                <span
                  className="inline-block h-3 w-3 flex-none rounded-sm border border-white/20"
                  style={{ background: t.value }}
                />
              ) : (
                <span className="inline-block h-3 w-3 flex-none" />
              )}
              <span className="truncate text-white/70">{t.name}</span>
              <span className="ml-auto truncate text-white/90">{t.value || "—"}</span>
            </li>
          ))}
        </ul>
      )}
      {!collapsed && (
        <div className="mt-2 border-t border-white/10 pt-1 text-[10px] text-white/50">
          Toggle: Alt+Shift+D · ?debug
        </div>
      )}
    </div>
  );
}
