"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, GripVertical, User } from "lucide-react";
import Link from "next/link";
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
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: task.id,
    data: { task, status: task.status },
  });

  const style = transform
    ? { transform: CSS.Translate.toString(transform) }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        group relative rounded-lg border bg-[var(--surface)] p-3 transition-shadow
        ${isDragging ? "shadow-lg opacity-50 border-[var(--border-strong)]" : "border-[var(--border)] hover:border-[var(--border-strong)]"}
      `}
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="absolute left-1 top-1/2 -translate-y-1/2 cursor-grab opacity-0 group-hover:opacity-100 transition-opacity text-[var(--text-tertiary)] active:cursor-grabbing"
      >
        <GripVertical className="h-3 w-3" />
      </div>

      <div className="pl-3">
        {/* Header: ID + priority */}
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

        {/* Title */}
        <Link
          href={`/tasks/${task.id}`}
          className="block text-sm font-medium text-[var(--text-primary)] hover:text-[var(--accent)] transition-colors line-clamp-2 mb-2"
        >
          {task.title}
        </Link>

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

          {task.assignee ? (
            <div className="flex items-center gap-1 text-[11px]">
              <User className="h-3 w-3" />
              <span>{task.assignee.display_name.split(" ")[0]}</span>
            </div>
          ) : null}
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
