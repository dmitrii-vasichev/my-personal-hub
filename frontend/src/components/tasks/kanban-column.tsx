"use client";

import { useMemo, useState } from "react";
import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
import type { Task, TaskStatus } from "@/types/task";
import { TASK_STATUS_LABELS } from "@/types/task";
import { TaskCard } from "./task-card";

interface KanbanColumnProps {
  status: TaskStatus;
  tasks: Task[];
  activeTaskId: number | null;
  onAddTask?: () => void;
  selectedTaskIds?: Set<number>;
  onToggleSelect?: (taskId: number) => void;
}

const STATUS_ACCENT: Record<TaskStatus, string> = {
  backlog: "var(--accent-2)",
  new: "var(--ink-3)",
  in_progress: "var(--accent)",
  review: "var(--accent-2)",
  done: "var(--accent-3)",
  cancelled: "var(--ink-4)",
};

const DONE_COLLAPSE_LIMIT = 10;

export function KanbanColumn({ status, tasks, activeTaskId, onAddTask, selectedTaskIds, onToggleSelect }: KanbanColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const [expanded, setExpanded] = useState(false);

  const isDone = status === "done";
  const shouldCollapse = isDone && tasks.length > DONE_COLLAPSE_LIMIT;
  const visibleTasks = shouldCollapse && !expanded ? tasks.slice(0, DONE_COLLAPSE_LIMIT) : tasks;

  const taskIds = useMemo(() => visibleTasks.map((t) => t.id), [visibleTasks]);

  return (
    <div className="group/col flex w-72 flex-shrink-0 flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center gap-2 px-1 font-mono">
        <span
          className="h-2 w-2"
          style={{ backgroundColor: STATUS_ACCENT[status] }}
          aria-hidden
        />
        <h3 className="text-[10.5px] uppercase tracking-[1.5px] text-[color:var(--ink-2)]">
          {TASK_STATUS_LABELS[status]}
        </h3>
        <span className="ml-auto flex h-5 min-w-5 items-center justify-center border border-[color:var(--line)] bg-[color:var(--bg-2)] px-1.5 text-[10px] text-[color:var(--ink-3)] font-mono">
          {tasks.length}
        </span>
        {onAddTask && (
          <button
            onClick={onAddTask}
            className="flex h-5 w-5 items-center justify-center border border-transparent text-[color:var(--ink-3)] opacity-0 transition-opacity hover:border-[color:var(--line)] hover:text-[color:var(--accent)] group-hover/col:opacity-100"
            title={`Add task to ${TASK_STATUS_LABELS[status]}`}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`
          flex min-h-24 flex-col gap-2 p-1 transition-colors
          ${isOver ? "outline outline-2 outline-[color:var(--accent)] outline-offset-[-2px]" : ""}
        `}
      >
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {visibleTasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isDragging={task.id === activeTaskId}
              selected={selectedTaskIds?.has(task.id) ?? false}
              onToggleSelect={onToggleSelect}
            />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex h-16 items-center justify-center border border-dashed border-[color:var(--line)] text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
            No tasks
          </div>
        )}

        {/* Show all / Show less toggle for Done column */}
        {shouldCollapse && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center justify-center gap-1 border border-[color:var(--line)] py-1.5 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:text-[color:var(--ink)] hover:border-[color:var(--line-2)] transition-colors"
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
