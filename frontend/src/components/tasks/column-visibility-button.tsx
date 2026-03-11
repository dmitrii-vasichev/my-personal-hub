"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Columns3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { TaskStatus } from "@/types/task";
import { TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/types/task";

interface ColumnVisibilityButtonProps {
  hiddenColumns: TaskStatus[];
  onHiddenColumnsChange: (columns: TaskStatus[]) => void;
}

const MIN_VISIBLE = 2;

export function ColumnVisibilityButton({
  hiddenColumns,
  onHiddenColumnsChange,
}: ColumnVisibilityButtonProps) {
  const [open, setOpen] = useState(false);

  const toggleColumn = useCallback(
    (status: TaskStatus) => {
      const isHidden = hiddenColumns.includes(status);
      if (isHidden) {
        // Unhide
        onHiddenColumnsChange(hiddenColumns.filter((c) => c !== status));
      } else {
        // Hide — but ensure at least MIN_VISIBLE remain
        const visibleCount = TASK_STATUS_ORDER.length - hiddenColumns.length;
        if (visibleCount <= MIN_VISIBLE) return;
        onHiddenColumnsChange([...hiddenColumns, status]);
      }
    },
    [hiddenColumns, onHiddenColumnsChange]
  );

  const hiddenCount = hiddenColumns.length;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="gap-1.5 h-8 text-sm">
            <Columns3 className="h-3.5 w-3.5" />
            Columns
            {hiddenCount > 0 && (
              <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] text-white">
                {hiddenCount}
              </span>
            )}
          </Button>
        }
      />
      <PopoverContent className="w-48 p-2">
        <div className="flex flex-col gap-0.5">
          <p className="px-2 py-1 text-xs font-medium text-[var(--text-tertiary)]">
            Toggle columns
          </p>
          {TASK_STATUS_ORDER.map((status) => {
            const isVisible = !hiddenColumns.includes(status);
            const visibleCount = TASK_STATUS_ORDER.length - hiddenColumns.length;
            const cantHide = isVisible && visibleCount <= MIN_VISIBLE;

            return (
              <label
                key={status}
                className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:bg-[var(--surface-hover)] transition-colors ${
                  cantHide ? "opacity-50 cursor-not-allowed" : ""
                }`}
              >
                <input
                  type="checkbox"
                  checked={isVisible}
                  disabled={cantHide}
                  onChange={() => toggleColumn(status)}
                  className="h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
                />
                <span className="text-[var(--text-primary)]">
                  {TASK_STATUS_LABELS[status]}
                </span>
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
