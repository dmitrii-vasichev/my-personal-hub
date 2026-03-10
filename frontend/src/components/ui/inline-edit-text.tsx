"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Pencil } from "lucide-react";

interface InlineEditTextProps {
  value: string;
  onSave: (v: string) => Promise<void>;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  type?: "text" | "number" | "url";
}

export function InlineEditText({
  value,
  onSave,
  className = "",
  inputClassName = "",
  placeholder = "Empty",
  type = "text",
}: InlineEditTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  const save = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draft, value, onSave]);

  const cancel = useCallback(() => { setDraft(value); setEditing(false); }, [value]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter") { e.preventDefault(); save(); }
  };

  if (editing) {
    return (
      <span className={`inline-flex items-center gap-1 ${className}`}>
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={save}
          disabled={saving}
          placeholder={placeholder}
          className={`rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 outline-none ring-1 ring-[var(--accent)]/30 text-[var(--text-primary)] ${inputClassName}`}
        />
      </span>
    );
  }

  return (
    <span
      className={`group/ie inline-flex items-center gap-1 cursor-pointer ${className}`}
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <span className={value ? "" : "text-[var(--text-tertiary)] italic"}>
        {value || placeholder}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </span>
  );
}
