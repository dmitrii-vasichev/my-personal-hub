"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell } from "lucide-react";
import { useDueReminders, useDismissReminder } from "@/hooks/use-task-reminders";

export function ReminderPoller() {
  const router = useRouter();
  const { data: dueReminders } = useDueReminders();
  const dismissReminder = useDismissReminder();

  // Track which reminder IDs we've already toasted to avoid duplicates
  const shownIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!dueReminders?.length) return;

    for (const task of dueReminders) {
      if (shownIds.current.has(task.id)) continue;
      shownIds.current.add(task.id);

      const toastId = `reminder-${task.id}`;
      toast(task.title, {
        id: toastId,
        description: task.deadline
          ? `Due: ${new Date(task.deadline).toLocaleDateString()}`
          : "Task reminder",
        icon: <Bell size={14} className="text-accent-amber" />,
        duration: Infinity, // keep until dismissed
        action: {
          label: "View",
          onClick: () => router.push(`/tasks/${task.id}`),
        },
        onDismiss: () => {
          dismissReminder.mutate(task.id);
        },
        onAutoClose: () => {
          dismissReminder.mutate(task.id);
        },
      });
    }
  }, [dueReminders, router, dismissReminder]);

  return null;
}
