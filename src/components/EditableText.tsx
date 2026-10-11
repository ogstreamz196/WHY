import { useEffect, useRef, useState, type ElementType } from "react";
import { Pencil, Check, X } from "lucide-react";
import { useEditMode } from "@/lib/editMode";

/**
 * Renders text that can be edited in-place by the Boss when edit mode is on.
 * The override is keyed globally so all visitors see the same edit.
 *
 *   <EditableText storageKey="home.hero.title" as="h1" className="...">
 *     Do you know why?
 *   </EditableText>
 */
export function EditableText({
  storageKey,
  children,
  as: Tag = "span",
  className,
  multiline = false,
}: {
  storageKey: string;
  children: string;
  as?: ElementType;
  className?: string;
  multiline?: boolean;
}) {
  const { editMode, getText, saveOverride } = useEditMode();
  const current = getText(storageKey, children);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(current);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null);

  useEffect(() => {
    if (!editing) setDraft(current);
  }, [current, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (!editMode) {
    return <Tag className={className}>{current}</Tag>;
  }

  if (editing) {
    return (
      <span
        className={`inline-flex flex-wrap items-center gap-1 rounded-lg bg-red-950/40 p-1 ring-2 ring-red-400 ${className ?? ""}`}
      >
        {multiline ? (
          <textarea
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-[200px] flex-1 rounded-md border border-red-300/60 bg-black/60 px-2 py-1 text-inherit outline-none"
            rows={3}
          />
        ) : (
          <input
            ref={inputRef as any}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-w-[120px] flex-1 rounded-md border border-red-300/60 bg-black/60 px-2 py-1 text-inherit outline-none"
          />
        )}
        <button
          type="button"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await saveOverride(storageKey, draft);
              setEditing(false);
            } finally {
              setSaving(false);
            }
          }}
          className="rounded-md bg-emerald-500 p-1 text-white"
          aria-label="Save text"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
        <button
          type="button"
          onClick={() => {
            setDraft(current);
            setEditing(false);
          }}
          className="rounded-md bg-white/10 p-1 text-white"
          aria-label="Cancel edit"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>
    );
  }

  return (
    <Tag
      className={`relative cursor-text rounded outline-dashed outline-1 outline-red-400/70 hover:outline-2 ${className ?? ""}`}
      onClick={() => setEditing(true)}
      title="Boss: click to edit"
    >
      {current}
      <span className="ml-1 inline-flex align-middle text-red-300">
        <Pencil className="inline h-3 w-3" />
      </span>
    </Tag>
  );
}
