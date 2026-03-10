"use client";

import { useEffect, useState } from "react";
import { LayoutList, Columns3 } from "lucide-react";

export type JobsViewMode = "table" | "kanban";

const STORAGE_KEY = "jobs-view-preference";

function getStoredView(): JobsViewMode {
  if (typeof window === "undefined") return "table";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "table" || stored === "kanban") return stored;
  return "table";
}

interface ViewToggleProps {
  value?: JobsViewMode;
  onChange: (view: JobsViewMode) => void;
}

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  const [view, setView] = useState<JobsViewMode>("table");

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = getStoredView();
    setView(stored);
    onChange(stored);
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

  const options: { mode: JobsViewMode; icon: typeof LayoutList; label: string }[] = [
    { mode: "table", icon: LayoutList, label: "Table" },
    { mode: "kanban", icon: Columns3, label: "Kanban" },
  ];

  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[var(--surface)] border border-[var(--border)] p-0.5">
      {options.map(({ mode, icon: Icon, label }) => (
        <button
          key={mode}
          onClick={() => handleChange(mode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
            view === mode
              ? "bg-[var(--accent)] text-white"
              : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}
