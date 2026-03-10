"use client";

import { useState } from "react";
import { Link2, Plus, X, Loader2, CheckSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  useJobLinkedTasks,
  useLinkJobToTask,
  useUnlinkJobFromTask,
} from "@/hooks/use-job-links";
import { useTasks } from "@/hooks/use-tasks";

interface LinkedTasksSectionProps {
  jobId: number;
}

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-[var(--muted)] text-[var(--text-secondary)]",
  in_progress: "bg-[var(--accent-muted)] text-[var(--accent-foreground)]",
  done: "bg-[#0f2d22] text-[#34d399]",
  cancelled: "bg-[var(--destructive-muted)] text-[var(--destructive)]",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "text-[var(--text-tertiary)]",
  medium: "text-[var(--accent-amber)]",
  high: "text-[var(--destructive)]",
  urgent: "text-[var(--destructive)]",
};

export function LinkedTasksSection({ jobId }: LinkedTasksSectionProps) {
  const { data: linkedTasks = [], isLoading } = useJobLinkedTasks(jobId);
  const linkMutation = useLinkJobToTask(jobId);
  const unlinkMutation = useUnlinkJobFromTask(jobId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allTasks = [] } = useTasks(
    dialogOpen ? { search: search || undefined } : {}
  );

  const linkedIds = new Set(linkedTasks.map((t) => t.id));
  const availableTasks = allTasks.filter((t) => !linkedIds.has(t.id));

  const handleLink = async (taskId: number) => {
    await linkMutation.mutateAsync(taskId);
  };

  const handleUnlink = async (taskId: number) => {
    await unlinkMutation.mutateAsync(taskId);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Linked Tasks
          </h3>
          {linkedTasks.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
              {linkedTasks.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setDialogOpen(true)}
          className="h-7 px-2 text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
        >
          <Plus className="h-3 w-3" />
          Link Task
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : linkedTasks.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <Link2 className="mx-auto mb-1.5 h-4 w-4 text-[var(--text-tertiary)]" />
          <p className="text-xs text-[var(--text-tertiary)]">No tasks linked</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {linkedTasks.map((task) => (
            <div
              key={task.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <CheckSquare className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                <span className="text-sm text-[var(--text-primary)] truncate">
                  {task.title}
                </span>
                <span
                  className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    STATUS_COLORS[task.status] || STATUS_COLORS.todo
                  }`}
                >
                  {task.status.replace("_", " ")}
                </span>
                <span
                  className={`shrink-0 text-[10px] font-mono uppercase ${
                    PRIORITY_COLORS[task.priority] || ""
                  }`}
                >
                  {task.priority}
                </span>
              </div>
              <button
                onClick={() => handleUnlink(task.id)}
                className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors"
                title="Unlink task"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Link Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="w-full max-w-md p-6">
            <DialogClose />
            <DialogTitle className="mb-4">Link Task</DialogTitle>
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {availableTasks.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No tasks found
                </p>
              ) : (
                availableTasks.map((task) => (
                  <button
                    key={task.id}
                    onClick={() => {
                      handleLink(task.id);
                      setDialogOpen(false);
                      setSearch("");
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <CheckSquare className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                    <span className="text-sm text-[var(--text-primary)] truncate">
                      {task.title}
                    </span>
                    <span
                      className={`ml-auto shrink-0 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        STATUS_COLORS[task.status] || STATUS_COLORS.todo
                      }`}
                    >
                      {task.status.replace("_", " ")}
                    </span>
                  </button>
                ))
              )}
            </div>
          </DialogPopup>
        </DialogPortal>
      </Dialog>
    </div>
  );
}
