"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, MessageSquare, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useCreateTaskUpdate, useTaskUpdates } from "@/hooks/use-tasks";
import type { TaskUpdateItem, UpdateType } from "@/types/task";

const UPDATE_ICONS: Record<UpdateType, typeof MessageSquare> = {
  comment: MessageSquare,
  status_change: ArrowRight,
  progress: TrendingUp,
  blocker: AlertTriangle,
};

const UPDATE_COLORS: Record<UpdateType, string> = {
  comment: "text-[var(--text-secondary)] bg-[var(--surface-hover)]",
  status_change: "text-[var(--accent)] bg-[var(--accent-muted)]",
  progress: "text-[var(--success)] bg-[var(--success)]/10",
  blocker: "text-[var(--danger)] bg-[var(--danger)]/10",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function UpdateItem({ update }: { update: TaskUpdateItem }) {
  const Icon = UPDATE_ICONS[update.type];
  const colorClass = UPDATE_COLORS[update.type];

  return (
    <div className="flex gap-3">
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${colorClass}`}>
        <Icon className="h-3 w-3" />
      </div>
      <div className="flex-1 pt-0.5">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {update.author?.display_name ?? "System"}
          </span>
          <span className="text-[11px] text-[var(--text-tertiary)]">
            {formatDate(update.created_at)}
          </span>
        </div>

        {update.type === "status_change" && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            {update.content
              ? update.content
              : <>Changed status from <b>{update.old_status ?? "—"}</b> to <b>{update.new_status}</b></>}
          </p>
        )}
        {update.type === "progress" && (
          <p className="mt-0.5 text-sm text-[var(--text-secondary)]">
            Progress: {update.progress_percent}%
            {update.content && <span className="ml-1">— {update.content}</span>}
          </p>
        )}
        {(update.type === "comment" || update.type === "blocker") && update.content && (
          <p className="mt-0.5 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
            {update.content}
          </p>
        )}
      </div>
    </div>
  );
}

interface TaskTimelineProps {
  taskId: number;
}

export function TaskTimeline({ taskId }: TaskTimelineProps) {
  const { data: updates, isLoading } = useTaskUpdates(taskId);
  const createUpdate = useCreateTaskUpdate(taskId);
  const [comment, setComment] = useState("");

  const handleAddComment = async () => {
    const text = comment.trim();
    if (!text) return;
    await createUpdate.mutateAsync({ type: "comment", content: text });
    setComment("");
  };

  return (
    <div className="flex flex-col gap-4">
      <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
        Activity
      </h3>

      {/* Comment form */}
      <div className="flex flex-col gap-2">
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="text-sm"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={handleAddComment}
            disabled={!comment.trim() || createUpdate.isPending}
          >
            {createUpdate.isPending ? "Posting…" : "Comment"}
          </Button>
        </div>
      </div>

      {/* Timeline */}
      {isLoading ? (
        <p className="text-sm text-[var(--text-tertiary)]">Loading…</p>
      ) : (
        <div className="flex flex-col gap-4">
          {(updates ?? []).map((update) => (
            <UpdateItem key={update.id} update={update} />
          ))}
          {(updates ?? []).length === 0 && (
            <p className="text-sm text-[var(--text-tertiary)]">No activity yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
