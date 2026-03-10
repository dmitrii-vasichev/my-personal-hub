"use client";

import { useState } from "react";
import { Calendar, Pencil, X } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(dateStr: string) {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }) + " " + date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

interface InlineEditDateProps {
  value: string | null;
  onSave: (value: string | null) => Promise<void>;
  placeholder?: string;
  mode?: "date" | "datetime";
}

export function InlineEditDate({
  value,
  onSave,
  placeholder = "Not set",
  mode = "date",
}: InlineEditDateProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleChange = async (newValue: string) => {
    setSaving(true);
    try {
      await onSave(newValue || null);
      setEditing(false);
    } catch {
      /* keep editing */
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setSaving(true);
    try {
      await onSave(null);
    } catch {
      /* ignore */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        {mode === "date" ? (
          <DatePicker
            value={value?.split("T")[0] ?? ""}
            onChange={(v) => { handleChange(v); }}
            placeholder={placeholder}
            clearable
          />
        ) : (
          <DateTimePicker
            value={value ?? ""}
            onChange={(v) => { handleChange(v); }}
            placeholder={placeholder}
            clearable
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="group/ie flex items-center gap-1.5 cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
      <span className={value ? "text-sm text-[var(--text-primary)]" : "text-sm text-[var(--text-tertiary)] italic"}>
        {value
          ? mode === "datetime"
            ? formatDateTime(value)
            : formatDate(value)
          : placeholder}
      </span>
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
      {value && (
        <button
          onClick={handleClear}
          disabled={saving}
          className="rounded p-0.5 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 hover:text-[var(--danger)] transition-all"
          title="Clear"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
