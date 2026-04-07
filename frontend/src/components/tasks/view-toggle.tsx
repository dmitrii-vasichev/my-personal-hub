"use client";

import { useEffect, useState } from "react";
import { LayoutList, Columns3 } from "lucide-react";

export type TasksViewMode = "table" | "kanban";

const STORAGE_KEY = "tasks-view-preference";
const MOBILE_BREAKPOINT = 768;

function getDefaultView(): TasksViewMode {
  if (typeof window === "undefined") return "kanban";
  return window.innerWidth < MOBILE_BREAKPOINT ? "table" : "kanban";
}

function getStoredView(): TasksViewMode | null {
  if (typeof window === "undefined") return null;
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "table" || stored === "kanban") return stored;
  return null;
}

interface ViewToggleProps {
  value?: TasksViewMode;
  onChange: (view: TasksViewMode) => void;
}

export function TasksViewToggle({ value, onChange }: ViewToggleProps) {
  const [view, setView] = useState<TasksViewMode>("kanban");

  // Hydrate: use stored preference, or fall back to screen-size default
  useEffect(() => {
    const stored = getStoredView();
    const initial = stored ?? getDefaultView();
    setView(initial);
    onChange(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync controlled value
  useEffect(() => {
    if (value !== undefined) setView(value);
  }, [value]);

  const handleChange = (newView: TasksViewMode) => {
    setView(newView);
    localStorage.setItem(STORAGE_KEY, newView);
    onChange(newView);
  };

  const options: { mode: TasksViewMode; icon: typeof LayoutList; label: string }[] = [
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
