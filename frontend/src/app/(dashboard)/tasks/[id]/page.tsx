"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, Clock, Edit, Eye, Lock, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ChecklistView } from "@/components/tasks/checklist-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { LinkedEvents } from "@/components/tasks/linked-events";
import { useAuth } from "@/lib/auth";
import { PRIORITY_BG_COLORS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/types/task";
import type { TaskStatus } from "@/types/task";

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}


export default function TaskDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taskId = Number(params.id);
  const { user } = useAuth();
  const { data: task, isLoading, error } = useTask(taskId);
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [showEditDialog, setShowEditDialog] = useState(false);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-tertiary)]">
        Loading task…
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-[var(--danger)]">Task not found</p>
        <Button variant="ghost" size="sm" onClick={() => router.push("/tasks")}>
          Back to Tasks
        </Button>
      </div>
    );
  }

  const canEdit =
    user?.role === "admin" ||
    task.user_id === user?.id ||
    task.assignee_id === user?.id;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    await updateTask.mutateAsync({ taskId: task.id, data: { status: newStatus } });
  };

  const handleChecklistToggle = async (itemId: string) => {
    const updated = task.checklist.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    );
    await updateTask.mutateAsync({ taskId: task.id, data: { checklist: updated } });
  };

  const handleDelete = async () => {
    if (!confirm("Delete this task? This action cannot be undone.")) return;
    await deleteTask.mutateAsync(task.id);
    router.push("/tasks");
  };

  return (
    <div className="mx-auto max-w-4xl">
      {/* Top bar */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <button
          onClick={() => router.push("/tasks")}
          className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tasks
        </button>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
              <Edit className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleteTask.isPending}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Delete
            </Button>
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Title */}
          <div>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">TASK-{task.id}</span>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)]">{task.title}</h1>
          </div>

          {/* Description */}
          {task.description && (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          )}

          {/* Checklist */}
          {task.checklist.length > 0 && (
            <ChecklistView
              items={task.checklist}
              onToggle={handleChecklistToggle}
              disabled={updateTask.isPending}
            />
          )}

          {/* Timeline */}
          <div className="border-t border-[var(--border)] pt-6">
            <TaskTimeline taskId={task.id} />
          </div>
        </div>

        {/* Sidebar: metadata */}
        <div className="flex flex-col gap-5 rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4 h-fit">
          {/* Status */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Status
            </span>
            <Select
              value={task.status}
              onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
              className="h-8 text-sm"
              disabled={!canEdit}
            >
              {TASK_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>
              ))}
            </Select>
          </div>

          {/* Priority */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Priority
            </span>
            <span className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BG_COLORS[task.priority]}`}>
              {task.priority}
            </span>
          </div>

          {/* Created by */}
          {task.owner_name && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Created by
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {task.owner_name}
              </div>
            </div>
          )}

          {/* Visibility */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Visibility
            </span>
            <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
              {task.visibility === "private" ? (
                <>
                  <Lock className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  Private
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                  Family
                </>
              )}
            </div>
          </div>

          {/* Assignee */}
          {task.assignee && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Assignee
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <User className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {task.assignee.display_name}
              </div>
            </div>
          )}

          {/* Deadline */}
          {task.deadline && (
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Deadline
              </span>
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(task.deadline)}
              </div>
            </div>
          )}

          {/* Linked Events */}
          <div className="border-t border-[var(--border)] pt-4">
            <LinkedEvents taskId={task.id} />
          </div>

          {/* Dates */}
          <div className="border-t border-[var(--border)] pt-4 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
              <Clock className="h-3 w-3" />
              Created {formatDate(task.created_at)}
            </div>
            {task.completed_at && (
              <div className="flex items-center gap-1.5 text-xs text-[var(--success)]">
                <Clock className="h-3 w-3" />
                Completed {formatDate(task.completed_at)}
              </div>
            )}
          </div>
        </div>
      </div>

      {showEditDialog && (
        <TaskDialog
          mode="edit"
          task={task}
          onClose={() => setShowEditDialog(false)}
        />
      )}
    </div>
  );
}
