"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Check, Pencil, Tag, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

interface InlineEditTagsProps {
  tags: string[];
  onSave: (tags: string[]) => Promise<void>;
}

export function InlineEditTags({ tags, onSave }: InlineEditTagsProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string[]>(tags);
  const [input, setInput] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(tags); }, [tags]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const addTag = (val: string) => {
    const t = val.trim().replace(/,+$/, "").trim();
    if (t && !draft.includes(t)) setDraft((prev) => [...prev, t]);
    setInput("");
  };

  const removeTag = (tag: string) => setDraft((prev) => prev.filter((t) => t !== tag));

  const save = useCallback(async () => {
    if (input.trim()) addTag(input);
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, input, onSave]);

  const cancel = useCallback(() => { setDraft(tags); setInput(""); setEditing(false); }, [tags]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(input); }
    else if (e.key === "Backspace" && input === "" && draft.length > 0) setDraft((prev) => prev.slice(0, -1));
    else if (e.key === "Escape") { e.preventDefault(); cancel(); }
  };

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex flex-wrap gap-1.5 rounded-md border border-[var(--accent)] bg-[var(--background)] px-2 py-1.5 ring-1 ring-[var(--accent)]/30 min-h-[32px]">
          {draft.map((tag) => (
            <span
              key={tag}
              className="flex items-center gap-1 rounded bg-[var(--surface-hover)] border border-[var(--border)] px-1.5 py-0.5 text-[11px] text-[var(--text-secondary)]"
            >
              {tag}
              <button type="button" onClick={() => removeTag(tag)} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={draft.length === 0 ? "Type and press Enter…" : ""}
            className="flex-1 min-w-[100px] bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none"
            disabled={saving}
          />
        </div>
        <div className="flex gap-1">
          <Tooltip content="Save">
            <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Cancel">
            <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 flex-wrap cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <Tag className="h-3 w-3 text-[var(--text-tertiary)] shrink-0" />
      {tags.length > 0 ? (
        tags.map((tag) => (
          <span
            key={tag}
            className="px-1.5 py-0.5 rounded text-[11px] bg-[var(--surface-hover)] border border-[var(--border)] text-[var(--text-secondary)]"
          >
            {tag}
          </span>
        ))
      ) : (
        <span className="text-[var(--text-tertiary)] italic text-xs">No tags</span>
      )}
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </div>
  );
}
