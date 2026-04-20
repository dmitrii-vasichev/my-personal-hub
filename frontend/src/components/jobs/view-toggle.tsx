"use client";

import { useEffect, useState } from "react";

export type JobsViewMode = "table" | "kanban";

const STORAGE_KEY = "jobs-view-preference";

function getStoredView(): JobsViewMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "table" || stored === "kanban") return stored;
  return null;
}

interface ViewToggleProps {
  value?: JobsViewMode;
  onChange: (view: JobsViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const [view, setView] = useState<JobsViewMode>("kanban");

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = getStoredView();
    if (stored) {
      setView(stored);
      onChange(stored);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync controlled value
  useEffect(() => {
    if (value !== undefined) setView(value);
  }, [value]);

  const handleChange = (newView: JobsViewMode) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
    onChange(newView);
  };

  const options: { mode: JobsViewMode; label: string }[] = [
    { mode: "kanban", label: "Kanban" },
    { mode: "table", label: "Table" },
  ];

  return (
    <div
      role="tablist"
      className="inline-flex border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
    >
      {options.map(({ mode, label }) => {
        const active = view === mode;
        return (
          <button
            key={mode}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => handleChange(mode)}
            className={`px-3 py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono transition-colors ${
              active
                ? "bg-[color:var(--accent)] text-[color:var(--bg)] font-bold"
                : "text-[color:var(--ink-3)] hover:text-[color:var(--ink)]"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
