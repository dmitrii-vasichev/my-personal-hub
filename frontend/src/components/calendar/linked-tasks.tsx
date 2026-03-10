"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTasks } from "@/hooks/use-tasks";
import {
  useEventLinkedTasks,
  useLinkEventToTask,
  useUnlinkEventFromTask,
} from "@/hooks/use-task-event-links";
import { PRIORITY_BG_COLORS } from "@/types/task";
import type { TaskPriority } from "@/types/task";

interface Props {
  eventId: number;
}

export function LinkedTasks({ eventId }: Props) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");

  const { data: linkedTasks = [], isLoading } = useEventLinkedTasks(eventId);
  const { data: allTasks = [] } = useTasks();
  const linkTask = useLinkEventToTask(eventId);
  const unlinkTask = useUnlinkEventFromTask(eventId);

  const linkedIds = new Set(linkedTasks.map((t) => t.id));
  const filtered = allTasks.filter(
    (t) =>
      !linkedIds.has(t.id) &&
      t.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async (taskId: number) => {
    await linkTask.mutateAsync(taskId);
    setShowPicker(false);
    setSearch("");
  };

  const handleUnlink = async (taskId: number) => {
    await unlinkTask.mutateAsync(taskId);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Linked Tasks
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowPicker(!showPicker)}
          className="h-6 gap-1 px-2 text-xs"
        >
          <Plus className="h-3 w-3" />
          Link
        </Button>
      </div>

      {showPicker && (
        <div className="rounded-md border border-[var(--border)] bg-[var(--bg-primary)] p-2 flex flex-col gap-1">
          <input
            autoFocus
            placeholder="Search tasks…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-[var(--text-tertiary)]">No tasks found</p>
            ) : (
              filtered.map((t) => (
                <button
                  key={t.id}
                  onClick={() => handleLink(t.id)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Square className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                  <span className="truncate">{t.title}</span>
                  <span className={`ml-auto shrink-0 rounded px-1.5 py-0.5 text-xs ${PRIORITY_BG_COLORS[t.priority as TaskPriority]}`}>
                    {t.priority}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--text-tertiary)]">Loading…</p>
      ) : linkedTasks.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No linked tasks</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {linkedTasks.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs"
            >
              <button
                onClick={() => router.push(`/tasks/${t.id}`)}
                className="text-[var(--text-primary)] hover:text-[var(--accent)]"
              >
                {t.title}
              </button>
              <button
                onClick={() => handleUnlink(t.id)}
                className="text-[var(--text-tertiary)] hover:text-[var(--danger)]"
                aria-label="Remove link"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
