"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogPopup,
  DialogPortal,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChecklistEditor } from "./checklist-editor";
import { useCreateTask, useUpdateTask } from "@/hooks/use-tasks";
import { useAuth } from "@/lib/auth";
import type { ChecklistItem, Task, TaskPriority } from "@/types/task";

interface TaskDialogProps {
  mode: "create" | "edit";
  task?: Task;
  onClose: () => void;
}

export function TaskDialog({ mode, task, onClose }: TaskDialogProps) {
  useAuth(); // auth context (reserved for future admin assignee feature)
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [priority, setPriority] = useState<TaskPriority>(task?.priority ?? "medium");
  const [deadline, setDeadline] = useState(
    task?.deadline ? task.deadline.split("T")[0] : ""
  );
  const [reminderAt, setReminderAt] = useState(
    task?.reminder_at ? task.reminder_at.slice(0, 16) : ""
  );
  const [checklist, setChecklist] = useState<ChecklistItem[]>(task?.checklist ?? []);
  const [error, setError] = useState<string | null>(null);

  const isLoading = createTask.isPending || updateTask.isPending;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    try {
      if (mode === "create") {
        await createTask.mutateAsync({
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          deadline: deadline || undefined,
          reminder_at: reminderAt || undefined,
          checklist,
        });
      } else if (task) {
        await updateTask.mutateAsync({
          taskId: task.id,
          data: {
            title: title.trim(),
            description: description.trim() || undefined,
            priority,
            deadline: deadline || null,
            reminder_at: reminderAt || null,
            checklist,
          },
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-lg p-6">
          <DialogClose />

          <DialogTitle className="mb-5">
            {mode === "create" ? "New Task" : "Edit Task"}
          </DialogTitle>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Title */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="title" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Title *
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title"
                autoFocus
              />
            </div>

            {/* Description */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="description" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Description
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description…"
                rows={3}
              />
            </div>

            {/* Priority + Deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="priority" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Priority
                </Label>
                <Select
                  id="priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                >
                  <option value="urgent">🔴 Urgent</option>
                  <option value="high">🟠 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deadline" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                  Deadline
                </Label>
                <Input
                  id="deadline"
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>

            {/* Reminder */}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="reminder_at" className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Reminder
              </Label>
              <Input
                id="reminder_at"
                type="datetime-local"
                value={reminderAt}
                onChange={(e) => setReminderAt(e.target.value)}
                className="text-sm"
              />
            </div>

            {/* Checklist */}
            <div className="flex flex-col gap-1.5">
              <Label className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wide">
                Checklist
              </Label>
              <ChecklistEditor items={checklist} onChange={setChecklist} />
            </div>

            {/* Error */}
            {error && (
              <p className="text-sm text-[var(--danger)]">{error}</p>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading
                  ? mode === "create"
                    ? "Creating…"
                    : "Saving…"
                  : mode === "create"
                    ? "Create Task"
                    : "Save Changes"}
              </Button>
            </div>
          </form>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
