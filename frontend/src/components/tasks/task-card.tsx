"use client";

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Eye, Lock, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Task } from "@/types/task";
import { PRIORITY_BORDER_CSS_VARS, PRIORITY_LABELS } from "@/types/task";

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

  const cardStyle = {
    ...(transform ? { transform: CSS.Translate.toString(transform) } : {}),
    borderLeftColor: PRIORITY_BORDER_CSS_VARS[task.priority],
  };

  const handleClick = () => {
    if (transform) return;
    router.push(`/tasks/${task.id}`);
  };

  return (
    <div
      ref={setNodeRef}
      style={cardStyle}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      title={`Priority: ${PRIORITY_LABELS[task.priority]}`}
      className={`
        group relative rounded-lg border border-l-[3px] bg-[var(--surface)] p-3 transition-shadow cursor-pointer
        ${isDragging ? "shadow-lg opacity-50 border-[var(--border-strong)] cursor-grabbing" : "border-[var(--border)] hover:border-[var(--border-strong)]"}
        active:cursor-grabbing
      `}
    >
      <div>
        {/* Header: visibility icon */}
        <div className="mb-1.5 flex items-center justify-end gap-1.5">
          <span title={task.visibility === "private" ? "Private" : "Family"}>
            {task.visibility === "private" ? (
              <Lock className="h-3 w-3 text-[var(--accent-violet)]" />
            ) : (
              <Eye className="h-3 w-3 text-[var(--accent-teal)]" />
            )}
          </span>
        </div>

        {/* Title */}
        <span className="block text-sm font-medium text-[var(--text-primary)] line-clamp-2 mb-2">
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
    <div
      style={{ borderLeftColor: PRIORITY_BORDER_CSS_VARS[task.priority] }}
      className="rounded-lg border border-l-[3px] border-[var(--accent)] bg-[var(--surface)] p-3 shadow-xl cursor-grabbing"
    >
      <div className="mb-1.5 flex items-center justify-end gap-1.5">
        <span>
          {task.visibility === "private" ? (
            <Lock className="h-3 w-3 text-[var(--accent-violet)]" />
          ) : (
            <Eye className="h-3 w-3 text-[var(--accent-teal)]" />
          )}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--text-primary)] line-clamp-2">
        {task.title}
      </p>
    </div>
  );
}
