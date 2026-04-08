"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useReminders, useSnoozeReminder, useMarkDone } from "@/hooks/use-reminders";
import type { Reminder } from "@/types/reminder";

/**
 * Background poller that shows browser toasts for due reminders.
 * Mounted once in AppShell — renders nothing.
 */
export function ReminderPoller() {
  const router = useRouter();
  const { data: reminders } = useReminders(false); // only pending
  const snoozeMutation = useSnoozeReminder();
  const markDoneMutation = useMarkDone();

  // Track which reminder IDs we've already toasted to avoid duplicates
  const shownIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!reminders?.length) {
      shownIds.current.clear();
      return;
    }

    const now = new Date();
    const horizon = new Date(now.getTime() + 15 * 60 * 1000); // +15 min

    const dueReminders = reminders.filter((r: Reminder) => {
      const effectiveTime = new Date(r.snoozed_until ?? r.remind_at);
      return r.status === "pending" && !r.is_floating && effectiveTime <= horizon;
    });

    // Clean up IDs for reminders no longer in due list (snoozed past horizon / done)
    const dueIds = new Set(dueReminders.map((r) => r.id));
    for (const id of shownIds.current) {
      if (!dueIds.has(id)) {
        shownIds.current.delete(id);
        toast.dismiss(`reminder-${id}`);
      }
    }

    for (const reminder of dueReminders) {
      if (shownIds.current.has(reminder.id)) continue;
      shownIds.current.add(reminder.id);

      const toastId = `reminder-${reminder.id}`;
      toast(reminder.title, {
        id: toastId,
        description: reminder.task_title
          ? `Task: ${reminder.task_title}`
          : `Due: ${new Date(reminder.snoozed_until ?? reminder.remind_at).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`,
        icon: <Bell size={14} className="text-accent-amber" />,
        duration: Infinity,
        closeButton: true,
        action: {
          label: "Done",
          onClick: () => {
            markDoneMutation.mutate(reminder.id);
            toast.dismiss(toastId);
          },
        },
        cancel: {
          label: "Snooze 15m",
          onClick: () => {
            snoozeMutation.mutate({ id: reminder.id, minutes: 15 });
            toast.dismiss(toastId);
          },
        },
      });
    }
  }, [reminders, router, snoozeMutation, markDoneMutation]);

  return null;
}
