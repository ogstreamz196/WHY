import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getUiOverrides, setUiOverride } from "@/lib/uiOverrides.functions";
import { useBossTheme } from "@/lib/useBossTheme";

type EditModeContextValue = {
  isBoss: boolean;
  editMode: boolean;
  setEditMode: (v: boolean) => void;
  overrides: Record<string, unknown>;
  getText: (key: string, fallback: string) => string;
  saveOverride: (key: string, value: unknown) => Promise<void>;
};

const EditModeContext = createContext<EditModeContextValue | null>(null);

export function EditModeProvider({ children }: { children: ReactNode }) {
  const isBoss = useBossTheme();
  const [editMode, setEditModeRaw] = useState(false);
  const qc = useQueryClient();
  const fetchOverrides = useServerFn(getUiOverrides);
  const saveFn = useServerFn(setUiOverride);

  const q = useQuery({
    queryKey: ["ui-overrides"],
    queryFn: () => fetchOverrides(),
    staleTime: 60_000,
  });

  const overrides = q.data?.overrides ?? {};

  // Apply / remove danger theme on body when editMode toggles
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.toggle("edit-mode-danger", editMode);
    return () => document.body.classList.remove("edit-mode-danger");
  }, [editMode]);

  // Force-off edit mode if user isn't boss anymore
  useEffect(() => {
    if (!isBoss && editMode) setEditModeRaw(false);
  }, [isBoss, editMode]);

  const value = useMemo<EditModeContextValue>(
    () => ({
      isBoss,
      editMode: editMode && isBoss,
      setEditMode: (v) => setEditModeRaw(v && isBoss),
      overrides,
      getText: (key, fallback) => {
        const v = overrides[key];
        if (typeof v === "string") return v;
        if (v && typeof v === "object" && "text" in (v as any) && typeof (v as any).text === "string") {
          return (v as any).text as string;
        }
        return fallback;
      },
      saveOverride: async (key, value) => {
        await saveFn({ data: { key, value } });
        await qc.invalidateQueries({ queryKey: ["ui-overrides"] });
      },
    }),
    [isBoss, editMode, overrides, saveFn, qc],
  );

  return <EditModeContext.Provider value={value}>{children}</EditModeContext.Provider>;
}

export function useEditMode() {
  const ctx = useContext(EditModeContext);
  if (!ctx) {
    // Safe fallback so consumers outside the provider still render the default text
    return {
      isBoss: false,
      editMode: false,
      setEditMode: () => {},
      overrides: {},
      getText: (_k: string, fallback: string) => fallback,
      saveOverride: async () => {},
    } as EditModeContextValue;
  }
  return ctx;
}

/** Read a text override with a default fallback. */
export function useOverrideText(key: string, fallback: string) {
  const { getText } = useEditMode();
  return getText(key, fallback);
}
