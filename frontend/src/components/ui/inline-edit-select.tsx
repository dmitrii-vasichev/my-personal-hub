"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  className?: string;
}

interface InlineEditSelectProps {
  value: string;
  options: SelectOption[];
  onSave: (value: string) => Promise<void>;
  renderValue?: (option: SelectOption | undefined) => React.ReactNode;
}

export function InlineEditSelect({
  value,
  options,
  onSave,
  renderValue,
}: InlineEditSelectProps) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && selectRef.current) {
      selectRef.current.focus();
    }
  }, [editing]);

  const currentOption = options.find((o) => o.value === value);

  const handleChange = async (newValue: string) => {
    if (newValue === value) {
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(newValue);
      setEditing(false);
    } catch {
      /* keep editing */
    } finally {
      setSaving(false);
    }
  };

  if (editing) {
    return (
      <select
        ref={selectRef}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onBlur={() => setEditing(false)}
        onKeyDown={(e) => { if (e.key === "Escape") setEditing(false); }}
        disabled={saving}
        className="rounded border border-[var(--accent)] bg-[var(--background)] px-1.5 py-0.5 text-sm outline-none ring-1 ring-[var(--accent)]/30 text-[var(--text-primary)]"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  const defaultRender = (opt: SelectOption | undefined) => (
    <span className={opt?.className ?? ""}>
      {opt?.label ?? value}
    </span>
  );

  return (
    <span
      className="group/ie inline-flex items-center gap-1 cursor-pointer"
      onClick={() => setEditing(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") setEditing(true); }}
    >
      {renderValue ? renderValue(currentOption) : defaultRender(currentOption)}
      <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
    </span>
  );
}
