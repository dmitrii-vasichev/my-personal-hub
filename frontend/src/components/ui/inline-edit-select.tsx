"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import {
  SelectRoot,
  SelectTrigger,
  SelectPopup,
  SelectItem,
} from "@/components/ui/select";

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
  const [saving, setSaving] = useState(false);

  const currentOption = options.find((o) => o.value === value);

  const handleValueChange = async (newValue: string | null) => {
    if (newValue === null || newValue === value) return;
    setSaving(true);
    try {
      await onSave(newValue);
    } catch {
      /* parent handles error state */
    } finally {
      setSaving(false);
    }
  };

  const defaultRender = (opt: SelectOption | undefined) => (
    <span className={opt?.className ?? ""}>{opt?.label ?? value}</span>
  );

  return (
    <SelectRoot
      value={value}
      onValueChange={handleValueChange}
      disabled={saving}
    >
      <SelectTrigger
        className="group/ie inline-flex items-center gap-1 rounded border-0 bg-transparent p-0 text-inherit cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/30"
      >
        {renderValue ? renderValue(currentOption) : defaultRender(currentOption)}
        <Pencil className="h-3 w-3 shrink-0 text-[var(--text-tertiary)] opacity-0 group-hover/ie:opacity-100 transition-opacity" />
      </SelectTrigger>
      <SelectPopup>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </SelectRoot>
  );
}
