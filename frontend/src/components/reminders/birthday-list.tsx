"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Cake, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useDeleteBirthday } from "@/hooks/use-birthdays";
import type { Birthday } from "@/types/birthday";

// -- Days-until badge --

function daysUntilLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function daysUntilBadgeClass(days: number): string {
  if (days === 0)
    return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  if (days <= 7)
    return "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400";
  return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
}

// -- Single birthday row --

function BirthdayRow({ birthday }: { birthday: Birthday }) {
  const deleteBirthday = useDeleteBirthday();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const formattedDate = format(parseISO(birthday.birth_date), "MMMM d");

  const handleDelete = () => {
    deleteBirthday.mutate(birthday.id, {
      onSuccess: () => {
        toast.success("Birthday deleted");
        setConfirmDelete(false);
      },
      onError: () => toast.error("Failed to delete"),
    });
  };

  return (
    <>
      <div className="group flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3 transition-colors hover:bg-muted/50">
        {/* Name */}
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate text-sm font-medium text-foreground">
            {birthday.name}
          </span>

          {/* Birth date */}
          <span className="text-sm text-muted-foreground">
            {formattedDate}
          </span>

          {/* Days until badge */}
          <span
            className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-medium ${daysUntilBadgeClass(birthday.days_until)}`}
          >
            {daysUntilLabel(birthday.days_until)}
          </span>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <Tooltip content="Delete">
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setConfirmDelete(true)}
              disabled={deleteBirthday.isPending}
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Delete birthday"
        description={`Are you sure you want to delete "${birthday.name}"?`}
        confirmLabel="Delete"
        variant="danger"
        loading={deleteBirthday.isPending}
      />
    </>
  );
}

// -- Main list component --

interface BirthdayListProps {
  birthdays: Birthday[];
  isLoading: boolean;
  error: Error | null;
}

export function BirthdayList({ birthdays, isLoading, error }: BirthdayListProps) {
  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse rounded-lg border border-border bg-card"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-destructive">
        Failed to load birthdays
      </div>
    );
  }

  if (birthdays.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted border border-border">
          <Cake className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            No birthdays
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Use the form above to add your first birthday
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {birthdays.map((b) => (
        <BirthdayRow key={b.id} birthday={b} />
      ))}
    </div>
  );
}
