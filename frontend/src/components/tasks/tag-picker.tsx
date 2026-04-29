"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Plus, Check } from "lucide-react";
import { toast } from "sonner";
import { useTags, useCreateTag } from "@/hooks/use-tags";
import { TAG_PRESET_COLORS } from "@/types/tag";
import { TagPill } from "./tag-pill";

interface TagPickerProps {
  selectedTagIds: number[];
  onChange: (ids: number[]) => void;
}

export function TagPicker({ selectedTagIds, onChange }: TagPickerProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState<string>(TAG_PRESET_COLORS[0].hex);
  const ref = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const { data: tags = [] } = useTags();
  const createTag = useCreateTag();

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setCreating(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    if (creating && nameInputRef.current) {
      nameInputRef.current.focus();
    }
  }, [creating]);

  const toggleTag = (tagId: number) => {
    if (selectedTagIds.includes(tagId)) {
      onChange(selectedTagIds.filter((id) => id !== tagId));
    } else {
      onChange([...selectedTagIds, tagId]);
    }
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      const created = await createTag.mutateAsync({ name: trimmed, color: newColor });
      onChange([...selectedTagIds, created.id]);
      setNewName("");
      setNewColor(TAG_PRESET_COLORS[0].hex);
      setCreating(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tag";
      toast.error(message);
    }
  };

  const selectedTags = tags.filter((t) => selectedTagIds.includes(t.id));

  return (
    <div ref={ref} className="relative">
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setOpen(!open); }}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:border-[var(--accent)] outline-none min-h-[34px] cursor-pointer"
      >
        {selectedTags.length > 0 ? (
          <span className="flex flex-1 flex-wrap gap-1">
            {selectedTags.map((tag) => (
              <TagPill
                key={tag.id}
                tag={tag}
                onRemove={() => toggleTag(tag.id)}
              />
            ))}
          </span>
        ) : (
          <span className="flex-1 text-left text-[var(--text-tertiary)]">Select tags…</span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </div>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-md">
          {tags.length === 0 && !creating && (
            <div className="px-3 py-2 text-xs text-[var(--text-tertiary)]">
              No tags yet — create one below
            </div>
          )}

          <div className="max-h-48 overflow-y-auto">
            {tags.map((tag) => {
              const selected = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                    selected ? "bg-[var(--surface-hover)]" : ""
                  }`}
                >
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="flex-1 text-left text-[var(--text-primary)]">{tag.name}</span>
                  {selected && <Check className="h-3.5 w-3.5 text-[var(--accent)]" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-[var(--border)]">
            {creating ? (
              <div className="p-2 space-y-2">
                <input
                  ref={nameInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleCreate();
                    }
                    if (e.key === "Escape") {
                      setCreating(false);
                      setNewName("");
                    }
                  }}
                  placeholder="Tag name"
                  maxLength={50}
                  className="w-full rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
                />
                <div className="flex gap-1">
                  {TAG_PRESET_COLORS.map((c) => (
                    <button
                      key={c.hex}
                      type="button"
                      onClick={() => setNewColor(c.hex)}
                      className={`h-5 w-5 rounded-full border-2 transition-transform ${
                        newColor === c.hex ? "border-[var(--text-primary)] scale-110" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c.hex }}
                      title={c.name}
                    />
                  ))}
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || createTag.isPending}
                    className="rounded bg-[var(--accent)] px-2.5 py-1 text-xs text-[var(--primary-foreground)] disabled:opacity-50 cursor-pointer"
                  >
                    {createTag.isPending ? "Creating…" : "Create"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setCreating(false); setNewName(""); }}
                    className="rounded px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-[var(--text-secondary)] transition-colors hover:bg-[var(--surface-hover)] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create tag</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
