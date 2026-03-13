"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Calendar, Eye, Lock, User } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Task } from "@/types/task";
import { PRIORITY_BORDER_CSS_VARS, PRIORITY_LABELS } from "@/types/task";
import { TagPills } from "./tag-pill";

interface TaskCardProps {
  task: Task;
  isDragging?: boolean;
  selected?: boolean;
  onToggleSelect?: (taskId: number) => void;
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

export function TaskCard({ task, isDragging = false, selected = false, onToggleSelect }: TaskCardProps) {
  const router = useRouter();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: task.id,
    data: { task, status: task.status, type: "task" },
  });

  const dragging = isDragging || isSortableDragging;

  const cardStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    borderLeftColor: PRIORITY_BORDER_CSS_VARS[task.priority],
  };

  const handleClick = (e: React.MouseEvent) => {
    if (transform && (Math.abs(transform.x) > 5 || Math.abs(transform.y) > 5)) return;
    // If shift-click or there's already a selection, toggle select instead of navigating
    if (e.shiftKey && onToggleSelect) {
      e.stopPropagation();
      onToggleSelect(task.id);
      return;
    }
    router.push(`/tasks/${task.id}`);
  };

  const handleCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onToggleSelect?.(task.id);
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
        ${dragging ? "shadow-lg opacity-50 border-[var(--border-strong)] cursor-grabbing z-10" : "border-[var(--border)] hover:border-[var(--border-strong)]"}
        ${selected ? "ring-2 ring-[var(--accent)] border-[var(--accent)]" : ""}
        active:cursor-grabbing
      `}
    >
      {/* Checkbox for multi-select */}
      {onToggleSelect && (
        <div
          onClick={handleCheckboxClick}
          className={`absolute top-2 left-2 z-10 flex h-4 w-4 items-center justify-center rounded border cursor-pointer transition-all ${
            selected
              ? "border-[var(--accent)] bg-[var(--accent)]"
              : "border-[var(--border-strong)] bg-[var(--background)] opacity-0 group-hover:opacity-100"
          }`}
        >
          {selected && (
            <svg className="h-3 w-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          )}
        </div>
      )}

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

        {/* Tag pills */}
        {task.tags && task.tags.length > 0 && (
          <div className="mb-2">
            <TagPills tags={task.tags} limit={2} />
          </div>
        )}

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
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2">
          <TagPills tags={task.tags} limit={2} />
        </div>
      )}
    </div>
  );
}
