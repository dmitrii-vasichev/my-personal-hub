"use client";

import type { ChecklistItem } from "@/types/checklist";

interface ChecklistViewProps {
  items: ChecklistItem[];
  onToggle: (itemId: string) => void;
  disabled?: boolean;
}

export function ChecklistView({ items, onToggle, disabled }: ChecklistViewProps) {
  if (items.length === 0) return null;

  const doneCount = items.filter((i) => i.completed).length;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Checklist
        </span>
        <span className="text-xs text-[var(--text-tertiary)]">
          {doneCount}/{items.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-1 w-full rounded-full bg-[var(--border)]">
        <div
          className="h-1 rounded-full bg-[var(--success)] transition-all"
          style={{ width: `${items.length ? (doneCount / items.length) * 100 : 0}%` }}
        />
      </div>

      <div className="flex flex-col gap-1.5 mt-1">
        {items.map((item) => (
          <label
            key={item.id}
            className={`flex items-start gap-2 cursor-pointer select-none ${disabled ? "opacity-60" : ""}`}
          >
            <input
              type="checkbox"
              checked={item.completed}
              onChange={() => !disabled && onToggle(item.id)}
              className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
              disabled={disabled}
            />
            <span
              className={`text-sm leading-snug ${item.completed ? "line-through text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}
            >
              {item.text}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}
