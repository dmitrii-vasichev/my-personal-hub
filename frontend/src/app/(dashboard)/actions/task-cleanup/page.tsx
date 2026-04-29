"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { ActionsTabs } from "@/components/actions/actions-tabs";
import { Button } from "@/components/ui/button";
import {
  usePreserveTaskLinkedReminders,
  useTaskCleanupReview,
} from "@/hooks/use-task-cleanup";
import type { TaskLinkedReminderReviewItem } from "@/types/task-cleanup";

function formatWhen(item: TaskLinkedReminderReviewItem): string {
  if (item.remind_at) {
    return new Date(item.remind_at).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  return item.action_date ?? "Inbox";
}

export default function TaskCleanupPage() {
  const { data: items = [], isLoading, error } = useTaskCleanupReview();
  const preserve = usePreserveTaskLinkedReminders();
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const allSelected = items.length > 0 && selected.size === items.length;
  const selectedIds = useMemo(() => Array.from(selected), [selected]);

  const toggle = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(items.map((item) => item.reminder_id)));
  };

  const handlePreserve = () => {
    preserve.mutate(selectedIds, {
      onSuccess: (result) => {
        toast.success(`Preserved ${result.preserved_count} reminder${result.preserved_count === 1 ? "" : "s"}`);
        setSelected(new Set());
      },
      onError: () => toast.error("Failed to preserve reminders"),
    });
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <header className="border-b-[1.5px] border-[color:var(--line)] pb-[14px]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-[1.5px] text-[color:var(--ink-3)] font-mono">
              Actions · Legacy Review
            </div>
            <h1 className="mt-1 font-bold text-[28px] leading-[1.1] tracking-[-0.4px] text-[color:var(--ink)]">
              TASK_CLEANUP_DRY_RUN_
            </h1>
            <p className="mt-2 max-w-[44rem] text-[12px] leading-relaxed text-[color:var(--ink-3)] font-mono">
              Review reminders still linked to old tasks. Preserve selected items by converting them into standalone Actions before any destructive cleanup is considered.
            </p>
          </div>
          <Link
            href="/actions"
            className="shrink-0 border-[1.5px] border-[color:var(--line)] px-3 py-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)] hover:border-[color:var(--line-2)] hover:text-[color:var(--ink)]"
          >
            Back
          </Link>
        </div>
      </header>

      <ActionsTabs />

      <div className="flex items-center justify-between gap-3 border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)] px-3 py-2">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[1.5px] font-mono text-[color:var(--ink-3)]">
          <ShieldCheck className="h-4 w-4 text-[color:var(--accent-3)]" />
          Dry-run only · no task deletion
        </div>
        <Button
          size="sm"
          disabled={selected.size === 0 || preserve.isPending}
          onClick={handlePreserve}
        >
          {preserve.isPending ? "Preserving..." : `Preserve selected (${selected.size})`}
        </Button>
      </div>

      {isLoading ? (
        <div className="border-[1.5px] border-[color:var(--line)] p-6 text-[12px] font-mono text-[color:var(--ink-3)]">
          Loading review list...
        </div>
      ) : error ? (
        <div className="border-[1.5px] border-[color:var(--line)] p-6 text-[12px] font-mono text-[color:var(--accent-2)]">
          Failed to load cleanup review.
        </div>
      ) : items.length === 0 ? (
        <div className="border-[1.5px] border-[color:var(--line)] p-6 text-[12px] font-mono text-[color:var(--ink-3)]">
          No task-linked reminders found.
        </div>
      ) : (
        <div className="overflow-x-auto border-[1.5px] border-[color:var(--line)]">
          <table className="min-w-full border-collapse text-left font-mono text-[12px]">
            <thead className="bg-[color:var(--bg-2)] text-[10px] uppercase tracking-[1.5px] text-[color:var(--ink-3)]">
              <tr>
                <th className="w-10 border-b border-[color:var(--line)] p-2">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label="Select all reminders"
                  />
                </th>
                <th className="border-b border-[color:var(--line)] p-2">Reminder</th>
                <th className="border-b border-[color:var(--line)] p-2">Task</th>
                <th className="border-b border-[color:var(--line)] p-2">When</th>
                <th className="border-b border-[color:var(--line)] p-2">Meta</th>
                <th className="border-b border-[color:var(--line)] p-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.reminder_id} className="border-b border-[color:var(--line)] last:border-b-0">
                  <td className="p-2 align-top">
                    <input
                      type="checkbox"
                      checked={selected.has(item.reminder_id)}
                      onChange={() => toggle(item.reminder_id)}
                      aria-label={`Select ${item.reminder_title}`}
                    />
                  </td>
                  <td className="max-w-[18rem] p-2 align-top text-[color:var(--ink)]">
                    {item.reminder_title}
                  </td>
                  <td className="max-w-[18rem] p-2 align-top text-[color:var(--ink-2)]">
                    {item.task_title}
                  </td>
                  <td className="p-2 align-top text-[color:var(--ink-2)]">
                    {formatWhen(item)}
                  </td>
                  <td className="p-2 align-top text-[color:var(--ink-3)]">
                    {[
                      item.is_urgent ? "Urgent" : null,
                      item.recurrence_rule,
                      item.checklist_count ? `${item.checklist_count} checks` : null,
                    ].filter(Boolean).join(" · ") || "None"}
                  </td>
                  <td className="max-w-[22rem] p-2 align-top text-[color:var(--ink-3)]">
                    {item.details || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
