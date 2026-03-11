"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { TaskPriority } from "@/types/task";
import { PRIORITY_DOT_COLORS, PRIORITY_LABELS } from "@/types/task";

const PRIORITIES: TaskPriority[] = ["urgent", "high", "medium", "low"];

interface PriorityPickerProps {
  value: TaskPriority;
  onChange: (value: TaskPriority) => void;
}

export function PriorityPicker({ value, onChange }: PriorityPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:border-[var(--accent)] outline-none"
      >
        <span className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_COLORS[value]}`} />
        <span className="flex-1 text-left">{PRIORITY_LABELS[value]}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-md">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => { onChange(p); setOpen(false); }}
              className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                p === value ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
              }`}
            >
              <span className={`h-2.5 w-2.5 rounded-full ${PRIORITY_DOT_COLORS[p]}`} />
              <span>{PRIORITY_LABELS[p]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
