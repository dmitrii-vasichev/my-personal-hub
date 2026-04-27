"use client";

import { useState, useRef, useEffect } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTags, useCreateTag, useUpdateTag, useDeleteTag } from "@/hooks/use-tags";
import { TAG_PRESET_COLORS } from "@/types/tag";
import type { Tag } from "@/types/tag";

const MAX_TAGS = 20;

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ── Color Preset Picker ─────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  return (
    <div className="flex gap-1">
      {TAG_PRESET_COLORS.map((c) => (
        <button
          key={c.hex}
          type="button"
          onClick={() => onChange(c.hex)}
          className={`h-5 w-5 rounded-full border-2 transition-transform cursor-pointer ${
            value === c.hex
              ? "border-[var(--text-primary)] scale-110"
              : "border-transparent"
          }`}
          style={{ backgroundColor: c.hex }}
          title={c.name}
        />
      ))}
    </div>
  );
}

// ── Inline Create Row ───────────────────────────────────────────────────────

function InlineCreateRow({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_PRESET_COLORS[0].hex);
  const inputRef = useRef<HTMLInputElement>(null);
  const createTag = useCreateTag();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await createTag.mutateAsync({ name: trimmed, color });
      toast.success(`Tag "${trimmed}" created`);
      onDone();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create tag";
      toast.error(message);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-dashed border-[var(--border-strong)] bg-[var(--surface)] px-4 py-3">
      <div
        className="h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <input
        ref={inputRef}
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") onDone();
        }}
        placeholder="Tag name"
        maxLength={50}
        className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-tertiary)]"
      />
      <ColorPicker value={color} onChange={setColor} />
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!name.trim() || createTag.isPending}
        className="rounded bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50 cursor-pointer"
      >
        {createTag.isPending ? "Creating…" : "Create"}
      </button>
      <button
        type="button"
        onClick={onDone}
        className="rounded px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
      >
        Cancel
      </button>
    </div>
  );
}

// ── Tag Row ─────────────────────────────────────────────────────────────────

function TagRow({
  tag,
  onDelete,
}: {
  tag: Tag;
  onDelete: (tag: Tag) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(tag.name);
  const [editColor, setEditColor] = useState(tag.color);
  const inputRef = useRef<HTMLInputElement>(null);
  const updateTag = useUpdateTag();

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const handleSave = async () => {
    const trimmed = editName.trim();
    if (!trimmed) {
      setEditName(tag.name);
      setEditing(false);
      return;
    }
    const changed =
      trimmed !== tag.name || editColor !== tag.color;
    if (!changed) {
      setEditing(false);
      return;
    }
    try {
      await updateTag.mutateAsync({
        tagId: tag.id,
        data: { name: trimmed, color: editColor },
      });
      toast.success("Tag updated");
      setEditing(false);
    } catch {
      toast.error("Failed to update tag — name may already exist");
    }
  };

  const handleCancel = () => {
    setEditName(tag.name);
    setEditColor(tag.color);
    setEditing(false);
  };

  return (
    <div className="group flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3 transition-colors hover:border-[var(--border-strong)]">
      {/* Color swatch — click to pick */}
      <div className="relative">
        {editing ? (
          <ColorPicker value={editColor} onChange={setEditColor} />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="h-3 w-3 shrink-0 rounded-full cursor-pointer"
            style={{ backgroundColor: editColor }}
            title="Click to change color"
          />
        )}
      </div>

      {/* Name — editable or static */}
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") handleCancel();
          }}
          maxLength={50}
          className="flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none border-b border-[var(--accent)]"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex-1 text-left text-sm text-[var(--text-primary)] cursor-pointer hover:text-[var(--accent)] transition-colors"
        >
          {tag.name}
        </button>
      )}

      {/* Task count */}
      <span
        className="shrink-0 rounded-full px-2 py-0.5 text-[11px]"
        style={{
          backgroundColor: hexToRgba(tag.color, 0.1),
          color: tag.color,
        }}
      >
        {tag.task_count} {tag.task_count === 1 ? "task" : "tasks"}
      </span>

      {/* Actions */}
      {editing ? (
        <div className="flex gap-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateTag.isPending}
            className="rounded bg-[var(--accent)] px-2.5 py-1 text-xs text-white disabled:opacity-50 cursor-pointer"
          >
            Save
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded px-2.5 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : (
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)] cursor-pointer"
            title="Edit tag"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onDelete(tag)}
            className="rounded p-1 text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--surface-hover)] cursor-pointer"
            title="Delete tag"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Delete Confirmation Dialog ──────────────────────────────────────────────

function DeleteConfirmDialog({
  tag,
  onConfirm,
  onCancel,
  isPending,
}: {
  tag: Tag;
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-xl border border-[var(--border)] bg-[var(--popover)] p-6 shadow-xl space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">
          Delete tag &ldquo;{tag.name}&rdquo;?
        </h3>
        <p className="text-sm text-[var(--text-secondary)]">
          It will be removed from {tag.task_count}{" "}
          {tag.task_count === 1 ? "task" : "tasks"}. Tasks themselves
          won&apos;t be deleted.
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-[var(--danger)] px-3 py-1.5 text-sm text-white disabled:opacity-50 cursor-pointer"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function TagsManagementTab() {
  const { data: tags = [], isLoading, isError } = useTags();
  const deleteTag = useDeleteTag();
  const [creating, setCreating] = useState(false);
  const [tagToDelete, setTagToDelete] = useState<Tag | null>(null);

  const atLimit = tags.length >= MAX_TAGS;

  const handleDelete = async () => {
    if (!tagToDelete) return;
    try {
      await deleteTag.mutateAsync(tagToDelete.id);
      toast.success(`Tag "${tagToDelete.name}" deleted`);
      setTagToDelete(null);
    } catch {
      toast.error("Failed to delete tag");
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--text-tertiary)]">
        Loading tags…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-[var(--danger)]">
        Failed to load tags — check backend connection
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--text-primary)]">Tags</h2>
          <p className="text-xs text-[var(--text-tertiary)]">
            {tags.length} / {MAX_TAGS} tags
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          disabled={creating || atLimit}
          title={atLimit ? `Maximum of ${MAX_TAGS} tags reached` : "Create a new tag"}
          className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Create tag
        </button>
      </div>

      {/* Create form */}
      {creating && <InlineCreateRow onDone={() => setCreating(false)} />}

      {/* Tag list */}
      {tags.length === 0 && !creating ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-[var(--border)] text-sm text-[var(--text-tertiary)]">
          No tags yet — create one to get started
        </div>
      ) : (
        <div className="space-y-2">
          {tags.map((tag) => (
            <TagRow key={tag.id} tag={tag} onDelete={setTagToDelete} />
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      {tagToDelete && (
        <DeleteConfirmDialog
          tag={tagToDelete}
          onConfirm={handleDelete}
          onCancel={() => setTagToDelete(null)}
          isPending={deleteTag.isPending}
        />
      )}
    </section>
  );
}
