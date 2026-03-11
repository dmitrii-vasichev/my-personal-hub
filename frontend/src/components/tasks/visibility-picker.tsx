"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Eye, Lock } from "lucide-react";
import type { Visibility } from "@/types/task";

const OPTIONS: { value: Visibility; label: string; icon: typeof Eye }[] = [
  { value: "family", label: "Family", icon: Eye },
  { value: "private", label: "Private", icon: Lock },
];

interface VisibilityPickerProps {
  value: Visibility;
  onChange: (value: Visibility) => void;
}

export function VisibilityPicker({ value, onChange }: VisibilityPickerProps) {
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

  const current = OPTIONS.find((o) => o.value === value)!;
  const CurrentIcon = current.icon;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-1.5 text-sm text-[var(--text-primary)] transition-colors hover:border-[var(--border-strong)] focus:border-[var(--accent)] outline-none"
      >
        <CurrentIcon className="h-3.5 w-3.5 text-[var(--text-secondary)]" />
        <span className="flex-1 text-left">{current.label}</span>
        <ChevronDown className={`h-3.5 w-3.5 text-[var(--text-tertiary)] transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--popover)] shadow-md">
          {OPTIONS.map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-[var(--surface-hover)] ${
                  opt.value === value ? "bg-[var(--surface-hover)] text-[var(--text-primary)]" : "text-[var(--text-secondary)]"
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{opt.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
