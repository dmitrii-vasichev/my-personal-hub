"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { Task, TaskStatus } from "@/types/task";
import { TASK_STATUS_LABELS } from "@/types/task";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  activeTaskId: number | null;
}

const STATUS_ACCENT: Record<TaskStatus, string> = {
  backlog: "bg-[var(--accent-violet)]",
  new: "bg-[var(--text-tertiary)]",
  in_progress: "bg-[var(--accent)]",
  review: "bg-yellow-500",
  done: "bg-[var(--success)]",
  cancelled: "bg-[var(--danger)]",
};

const DONE_COLLAPSE_LIMIT = 10;

export function KanbanColumn({ status, tasks, activeTaskId }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [expanded, setExpanded] = useState(false);

  const isDone = status === "done";
  const shouldCollapse = isDone && tasks.length > DONE_COLLAPSE_LIMIT;
  const visibleTasks = shouldCollapse && !expanded ? tasks.slice(0, DONE_COLLAPSE_LIMIT) : tasks;

  const taskIds = useMemo(() => visibleTasks.map((t) => t.id), [visibleTasks]);

  return (
    <div className="flex w-72 flex-shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1">
        <span className={`h-2 w-2 rounded-full ${STATUS_ACCENT[status]}`} />
        <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded bg-[var(--surface)] px-1.5 text-[11px] font-medium text-[var(--text-tertiary)]">
          {tasks.length}
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex min-h-24 flex-col gap-2 rounded-lg p-1 transition-colors
          ${isOver ? "bg-[var(--accent-muted)] ring-1 ring-[var(--accent)]" : ""}
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={task.id === activeTaskId}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-16 items-center justify-center rounded border border-dashed border-[var(--border)] text-xs text-[var(--text-tertiary)]">
            No tasks
          </div>
        )}

        {/* Show all / Show less toggle for Done column */}
        {shouldCollapse && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] transition-colors"
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Show all ({tasks.length})
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
