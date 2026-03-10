"use client";

import { useState, useRef, useEffect, useCallback, type KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronUp, Pencil, X } from "lucide-react";
import { Tooltip } from "@/components/ui/tooltip";

const COLLAPSED_MAX_HEIGHT = 96;

interface CollapsibleDescriptionProps {
  description: string;
  onSave: (v: string) => Promise<void>;
  label?: string;
  placeholder?: string;
}

export function CollapsibleDescription({
  description,
  onSave,
  label = "Description",
  placeholder = "Add description…",
}: CollapsibleDescriptionProps) {
  const [expanded, setExpanded] = useState(false);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [fullHeight, setFullHeight] = useState<number>(0);
  const contentRef = useRef<HTMLDivElement>(null);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(description);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(description); }, [description]);
  useEffect(() => {
    if (contentRef.current) {
      const h = contentRef.current.scrollHeight;
      setFullHeight(h);
      setNeedsCollapse(h > COLLAPSED_MAX_HEIGHT);
    }
  }, [description]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(textareaRef.current.value.length, textareaRef.current.value.length);
    }
  }, [editing]);

  const save = useCallback(async () => {
    if (draft === description) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(draft); setEditing(false); } catch { /* keep editing */ } finally { setSaving(false); }
  }, [draft, description, onSave]);

  const cancel = useCallback(() => { setDraft(description); setEditing(false); }, [description]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); cancel(); }
    else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); save(); }
  };

  if (editing) {
    return (
      <div>
        <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </h3>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={saving}
          rows={10}
          className="w-full rounded-md border border-[var(--accent)] bg-[var(--background)] px-2.5 py-2 text-sm leading-relaxed text-[var(--text-primary)] outline-none ring-1 ring-[var(--accent)]/30 resize-y"
          placeholder={placeholder}
        />
        <div className="flex items-center gap-1 mt-1.5">
          <Tooltip content="Save (Cmd+Enter)">
            <button onClick={save} disabled={saving} className="rounded p-1 text-[var(--success)] hover:bg-[var(--surface-hover)] transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <Tooltip content="Cancel (Esc)">
            <button onClick={cancel} disabled={saving} className="rounded p-1 text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)] transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </Tooltip>
          <span className="text-[10px] text-[var(--text-tertiary)] ml-1">Cmd+Enter to save, Esc to cancel</span>
        </div>
      </div>
    );
  }

  if (!description) {
    return (
      <div className="group/desc">
        <div className="flex items-center gap-1.5 mb-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            {label}
          </h3>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="text-sm text-[var(--text-tertiary)] italic flex items-center gap-1 hover:text-[var(--text-secondary)] transition-colors"
        >
          <Pencil className="h-3 w-3" />
          {placeholder}
        </button>
      </div>
    );
  }

  return (
    <div className="group/desc">
      <div className="flex items-center gap-1.5 mb-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </h3>
        <button
          onClick={() => setEditing(true)}
          className="rounded p-0.5 text-[var(--text-tertiary)] opacity-0 group-hover/desc:opacity-100 hover:bg-[var(--surface-hover)] transition-all"
          title={`Edit ${label.toLowerCase()}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      </div>
      <div className="relative">
        <div
          ref={contentRef}
          className="overflow-hidden transition-[max-height] duration-300 ease-in-out"
          style={{
            maxHeight: !needsCollapse || expanded ? fullHeight || "none" : COLLAPSED_MAX_HEIGHT,
          }}
        >
          <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
            {description}
          </p>
        </div>
        {needsCollapse && !expanded && (
          <div className="absolute bottom-0 left-0 right-0 h-10 bg-gradient-to-t from-[var(--bg)] to-transparent pointer-events-none" />
        )}
      </div>
      {needsCollapse && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-1.5 flex items-center gap-1 text-xs text-[var(--accent-foreground)] hover:text-[var(--accent-hover)] transition-colors"
        >
          {expanded ? (
            <>
              <ChevronUp className="h-3.5 w-3.5" />
              Show less
            </>
          ) : (
            <>
              <ChevronDown className="h-3.5 w-3.5" />
              Show more
            </>
          )}
        </button>
      )}
    </div>
  );
}
