"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Eye, GripVertical, Lock, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Task } from "@/types/task";
import { PRIORITY_BG_COLORS } from "@/types/task";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
}

function formatDeadline(deadline: string): string {
  const date = new Date(deadline);
  const now = new Date();
  const isOverdue = date < now;
  const formatted = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${isOverdue ? "⚠ " : ""}${formatted}`;
}

function isDeadlineOverdue(deadline: string): boolean {
  return new Date(deadline) < new Date();
}

export function TaskCard({ task, isDragging = false }: TaskCardProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task, status: task.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  const handleClick = () => {
    if (transform) return;
    router.push(`/tasks/${task.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      className={`
        group relative rounded-lg border bg-[var(--surface)] p-3 transition-shadow cursor-pointer
        ${isDragging ? "shadow-lg opacity-50 border-[var(--border-strong)] cursor-grabbing" : "border-[var(--border)] hover:border-[var(--border-strong)]"}
        active:cursor-grabbing
      `}
    >
      {/* Drag handle (visual indicator only) */}
      <div className="absolute left-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)]">
        <GripVertical className="h-3 w-3" />
      </div>

      <div className="pl-3">
        {/* Header: ID + visibility + priority */}
        <div className="mb-1.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
              TASK-{task.id}
            </span>
            <span title={task.visibility === "private" ? "Private" : "Family"}>
              {task.visibility === "private" ? (
                <Lock className="h-2.5 w-2.5 text-[var(--text-tertiary)]" />
              ) : (
                <Eye className="h-2.5 w-2.5 text-[var(--text-tertiary)]" />
              )}
            </span>
          </div>
          <span
            className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_BG_COLORS[task.priority]}`}
          >
            {task.priority}
          </span>
        </div>

        {/* Title */}
        <span className="block text-sm font-medium text-[var(--text-primary)] group-hover:text-[var(--accent-foreground)] transition-colors line-clamp-2 mb-2">
          {task.title}
        </span>

        {/* Footer: deadline + assignee */}
        <div className="flex items-center justify-between gap-2 text-[var(--text-tertiary)]">
          {task.deadline ? (
            <div
              className={`flex items-center gap-1 text-[11px] ${isDeadlineOverdue(task.deadline) ? "text-[var(--danger)]" : ""}`}
            >
              <Calendar className="h-3 w-3" />
              {formatDeadline(task.deadline)}
            </div>
          ) : (
            <span />
          )}

          <div className="flex items-center gap-2">
            {task.owner_name && (
              <span className="text-[11px] text-[var(--text-tertiary)]" title={`Owner: ${task.owner_name}`}>
                {task.owner_name.split(" ")[0]}
              </span>
            )}
            {task.assignee ? (
              <div className="flex items-center gap-1 text-[11px]">
                <User className="h-3 w-3" />
                <span>{task.assignee.display_name.split(" ")[0]}</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

// Overlay version (shown while dragging)
export function TaskCardOverlay({ task }: { task: Task }) {
  return (
    <div className="rounded-lg border border-[var(--accent)] bg-[var(--surface)] p-3 shadow-xl cursor-grabbing">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] text-[var(--text-tertiary)]">
          TASK-{task.id}
        </span>
        <span
          className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${PRIORITY_BG_COLORS[task.priority]}`}
        >
          {task.priority}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
        {task.title}
      </p>
    </div>
  );
}
