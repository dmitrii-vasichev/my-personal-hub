"use client";

import { useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar, ChevronDown, ChevronUp, Clock, Eye, Lock, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { InlineEditText } from "@/components/ui/inline-edit-text";
import { InlineEditSelect } from "@/components/ui/inline-edit-select";
import { InlineEditDate } from "@/components/ui/inline-edit-date";
import { CollapsibleDescription } from "@/components/ui/collapsible-description";
import { ChecklistEditor } from "@/components/tasks/checklist-editor";
import { TaskTimeline } from "@/components/tasks/task-timeline";
import { useTask, useUpdateTask, useDeleteTask } from "@/hooks/use-tasks";
import { LinkedEvents } from "@/components/tasks/linked-events";
import { LinkedNotesSection } from "@/components/notes/linked-notes-section";
import {
  useTaskLinkedNotes,
  useLinkNoteToTask,
  useUnlinkNoteFromTask,
} from "@/hooks/use-note-links";
import { useAuth } from "@/lib/auth";
import { PRIORITY_BG_COLORS, TASK_STATUS_LABELS, TASK_STATUS_ORDER } from "@/types/task";
import type { ChecklistItem, TaskPriority, TaskStatus, UpdateTaskInput, Visibility } from "@/types/task";

const CHECKLIST_COLLAPSE_THRESHOLD = 5;

const PRIORITY_OPTIONS = [
  { value: "urgent", label: "Urgent", className: PRIORITY_BG_COLORS.urgent },
  { value: "high", label: "High", className: PRIORITY_BG_COLORS.high },
  { value: "medium", label: "Medium", className: PRIORITY_BG_COLORS.medium },
  { value: "low", label: "Low", className: PRIORITY_BG_COLORS.low },
];

const VISIBILITY_OPTIONS = [
  { value: "family", label: "Family" },
  { value: "private", label: "Private" },
];

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
  const { data: linkedNotes = [], isLoading: notesLoading } = useTaskLinkedNotes(taskId);
  const linkNote = useLinkNoteToTask(taskId);
  const unlinkNote = useUnlinkNoteFromTask(taskId);
  const [checklistExpanded, setChecklistExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const patchTask = useCallback(
    async (data: UpdateTaskInput) => {
      if (!task) return;
      await updateTask.mutateAsync({ taskId: task.id, data });
      toast.success("Updated");
    },
    [task, updateTask]
  );

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

  const handleChecklistChange = async (items: ChecklistItem[]) => {
    await patchTask({ checklist: items });
  };

  const handleDelete = async () => {
    await deleteTask.mutateAsync(task.id);
    router.push("/tasks");
  };

  const checklist = task.checklist ?? [];
  const visibleChecklist = checklistExpanded || checklist.length <= CHECKLIST_COLLAPSE_THRESHOLD
    ? checklist
    : checklist.slice(0, CHECKLIST_COLLAPSE_THRESHOLD);
  const hiddenCount = checklist.length - CHECKLIST_COLLAPSE_THRESHOLD;
  const doneCount = checklist.filter((i) => i.completed).length;

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
          <Button
            variant="destructive"
            size="sm"
            onClick={() => setShowDeleteConfirm(true)}
            disabled={deleteTask.isPending}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
        title="Delete Task"
        description="Delete this task? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteTask.isPending}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Main content */}
        <div className="flex flex-col gap-6">
          {/* Title */}
          <div>
            <span className="font-mono text-xs text-[var(--text-tertiary)]">TASK-{task.id}</span>
            <h1 className="mt-1 text-2xl font-semibold text-[var(--text-primary)] leading-tight">
              {canEdit ? (
                <InlineEditText
                  value={task.title}
                  onSave={(v) => patchTask({ title: v.trim() || task.title })}
                  inputClassName="text-2xl font-semibold w-full"
                  placeholder="Task title"
                />
              ) : (
                task.title
              )}
            </h1>
          </div>

          {/* Description */}
          {canEdit ? (
            <CollapsibleDescription
              description={task.description ?? ""}
              onSave={(v) => patchTask({ description: v.trim() || undefined })}
              placeholder="Add description…"
            />
          ) : task.description ? (
            <div>
              <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Description
              </h3>
              <p className="text-sm leading-relaxed text-[var(--text-primary)] whitespace-pre-wrap">
                {task.description}
              </p>
            </div>
          ) : null}

          {/* Checklist */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
                Checklist
              </span>
              {checklist.length > 0 && (
                <span className="text-xs text-[var(--text-tertiary)]">
                  {doneCount}/{checklist.length}
                </span>
              )}
            </div>

            {/* Progress bar */}
            {checklist.length > 0 && (
              <div className="h-1 w-full rounded-full bg-[var(--border)] mb-3">
                <div
                  className="h-1 rounded-full bg-[var(--success)] transition-all"
                  style={{ width: `${(doneCount / checklist.length) * 100}%` }}
                />
              </div>
            )}

            {canEdit ? (
              <>
                <ChecklistEditor
                  items={visibleChecklist}
                  onChange={(items) => {
                    if (checklistExpanded || checklist.length <= CHECKLIST_COLLAPSE_THRESHOLD) {
                      handleChecklistChange(items);
                    } else {
                      handleChecklistChange([...items, ...checklist.slice(CHECKLIST_COLLAPSE_THRESHOLD)]);
                    }
                  }}
                />
                {checklist.length > CHECKLIST_COLLAPSE_THRESHOLD && (
                  <button
                    onClick={() => setChecklistExpanded(!checklistExpanded)}
                    className="mt-2 flex items-center gap-1 text-xs text-[var(--accent-foreground)] hover:text-[var(--accent-hover)] transition-colors"
                  >
                    {checklistExpanded ? (
                      <>
                        <ChevronUp className="h-3.5 w-3.5" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3.5 w-3.5" />
                        Show {hiddenCount} more
                      </>
                    )}
                  </button>
                )}
              </>
            ) : checklist.length > 0 ? (
              <div className="flex flex-col gap-1.5">
                {visibleChecklist.map((item) => (
                  <label key={item.id} className="flex items-start gap-2 select-none">
                    <input
                      type="checkbox"
                      checked={item.completed}
                      readOnly
                      className="mt-0.5 h-3.5 w-3.5 rounded border-[var(--border)] accent-[var(--accent)]"
                    />
                    <span className={`text-sm leading-snug ${item.completed ? "line-through text-[var(--text-tertiary)]" : "text-[var(--text-primary)]"}`}>
                      {item.text}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--text-tertiary)] italic">No checklist items</p>
            )}
          </div>

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
            {canEdit ? (
              <InlineEditSelect
                value={task.priority}
                options={PRIORITY_OPTIONS}
                onSave={(v) => patchTask({ priority: v as TaskPriority })}
                renderValue={(opt) => (
                  <span className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${opt?.className ?? ""}`}>
                    {opt?.label ?? task.priority}
                  </span>
                )}
              />
            ) : (
              <span className={`inline-flex w-fit items-center rounded px-2 py-0.5 text-xs font-medium ${PRIORITY_BG_COLORS[task.priority]}`}>
                {task.priority}
              </span>
            )}
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
            {canEdit ? (
              <InlineEditSelect
                value={task.visibility}
                options={VISIBILITY_OPTIONS}
                onSave={(v) => patchTask({ visibility: v as Visibility })}
                renderValue={(opt) => (
                  <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                    {opt?.value === "private" ? (
                      <Lock className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    ) : (
                      <Eye className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                    )}
                    {opt?.label}
                  </div>
                )}
              />
            ) : (
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
            )}
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
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Deadline
            </span>
            {canEdit ? (
              <InlineEditDate
                value={task.deadline}
                onSave={(v) => patchTask({ deadline: v })}
                placeholder="No deadline"
                mode="date"
              />
            ) : task.deadline ? (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(task.deadline)}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-tertiary)] italic">No deadline</span>
            )}
          </div>

          {/* Reminder */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
              Reminder
            </span>
            {canEdit ? (
              <InlineEditDate
                value={task.reminder_at}
                onSave={(v) => patchTask({ reminder_at: v })}
                placeholder="No reminder"
                mode="datetime"
              />
            ) : task.reminder_at ? (
              <div className="flex items-center gap-1.5 text-sm text-[var(--text-primary)]">
                <Calendar className="h-3.5 w-3.5 text-[var(--text-tertiary)]" />
                {formatDate(task.reminder_at)}
              </div>
            ) : (
              <span className="text-sm text-[var(--text-tertiary)] italic">No reminder</span>
            )}
          </div>

          {/* Linked Events */}
          <div className="border-t border-[var(--border)] pt-4">
            <LinkedEvents taskId={task.id} />
          </div>

          {/* Linked Notes */}
          <div className="border-t border-[var(--border)] pt-4">
            <LinkedNotesSection
              notes={linkedNotes}
              isLoading={notesLoading}
              onLink={(noteId) => linkNote.mutate(noteId)}
              onUnlink={(noteId) => unlinkNote.mutate(noteId)}
              isLinking={linkNote.isPending}
            />
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
    </div>
  );
}
