"use client";

import { useState } from "react";
import { format, parseISO } from "date-fns";
import { Cake, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DatePicker } from "@/components/ui/date-picker";
import { TimePicker } from "@/components/ui/time-picker";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { useDeleteBirthday, useUpdateBirthday } from "@/hooks/use-birthdays";
import type { Birthday } from "@/types/birthday";

// -- Days-until badge --

function daysUntilLabel(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

function daysUntilBadgeClass(days: number): string {
  if (days === 0)
    return "bg-[color:var(--accent)] text-[color:var(--bg)]";
  if (days <= 7)
    return "border border-[color:var(--accent-2)] text-[color:var(--accent-2)]";
  return "border border-[color:var(--line-2)] text-[color:var(--ink-3)]";
}

// -- Edit form (mounts fresh when dialog opens) --

function EditBirthdayForm({
  birthday,
  onClose,
}: {
  birthday: Birthday;
  onClose: () => void;
}) {
  const [name, setName] = useState(birthday.name);
  const [birthDate, setBirthDate] = useState(birthday.birth_date);
  const [birthYear, setBirthYear] = useState(
    birthday.birth_year?.toString() ?? ""
  );
  const [advanceDays, setAdvanceDays] = useState(
    birthday.advance_days.toString()
  );
  const [reminderTime, setReminderTime] = useState(birthday.reminder_time);
  const updateBirthday = useUpdateBirthday();

  const canSubmit = name.trim().length > 0 && birthDate.length > 0;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;

    const yearNum = birthYear ? parseInt(birthYear, 10) : null;

    updateBirthday.mutate(
      {
        id: birthday.id,
        name: name.trim(),
        birth_date: birthDate,
        birth_year:
          yearNum && yearNum > 1900 && yearNum <= new Date().getFullYear()
            ? yearNum
            : null,
        advance_days: Number.isFinite(parseInt(advanceDays, 10)) ? parseInt(advanceDays, 10) : 0,
        reminder_time: reminderTime || "08:00",
      },
      {
        onSuccess: () => {
          toast.success("Birthday updated");
          onClose();
        },
        onError: () => toast.error("Failed to update birthday"),
      }
    );
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Name
        </label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoComplete="off"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Birth date
          </label>
          <DatePicker
            value={birthDate}
            onChange={setBirthDate}
            placeholder="Select date"
            monthDayOnly
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Year (optional)
          </label>
          <Input
            type="number"
            min={1900}
            max={new Date().getFullYear()}
            placeholder="e.g. 1990"
            value={birthYear}
            onChange={(e) => setBirthYear(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Days before
          </label>
          <Input
            type="number"
            min={0}
            max={30}
            value={advanceDays}
            onChange={(e) => setAdvanceDays(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Remind at
          </label>
          <TimePicker
            value={reminderTime}
            onChange={setReminderTime}
            className="w-full"
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={!canSubmit || updateBirthday.isPending}
        >
          {updateBirthday.isPending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

function EditBirthdayDialog({
  birthday,
  open,
  onOpenChange,
}: {
  birthday: Birthday;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          <DialogClose />
          <DialogTitle>Edit birthday</DialogTitle>
          {open && (
            <EditBirthdayForm
              birthday={birthday}
              onClose={() => onOpenChange(false)}
            />
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// -- Single birthday row --

function BirthdayRow({
  birthday,
  expanded,
  onToggle,
}: {
  birthday: Birthday;
  expanded: boolean;
  onToggle: () => void;
}) {
  const deleteBirthday = useDeleteBirthday();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const formattedDate = format(parseISO(birthday.birth_date), "MMMM d");
  const isPending = deleteBirthday.isPending;

  const handleDelete = () => {
    deleteBirthday.mutate(birthday.id, {
      onSuccess: () => {
        toast.success("Birthday deleted");
        setConfirmDelete(false);
      },
      onError: () => toast.error("Failed to delete"),
    });
  };

  /* -- Expanded action panel (click-to-expand) -- */
  const expandedActions = expanded && (
    <div className="grid grid-cols-2 gap-2 border-t border-[color:var(--line)] bg-[color:var(--bg)] px-4 py-2.5">
      <button
        className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-[color:var(--ink-2)] active:bg-[color:var(--bg-2)]"
        onClick={() => setEditOpen(true)}
        disabled={isPending}
      >
        <Pencil className="h-5 w-5" />
        Edit
      </button>
      <button
        className="flex flex-col items-center gap-1 py-2 text-xs font-medium text-[color:var(--danger)] active:bg-[color:var(--bg-2)]"
        onClick={() => setConfirmDelete(true)}
        disabled={isPending}
      >
        <Trash2 className="h-5 w-5" />
        Delete
      </button>
    </div>
  );

  return (
    <>
      <div
        className={`group overflow-hidden border-[1.5px] bg-[color:var(--bg-2)] transition-colors ${
          expanded
            ? "border-[color:var(--accent)]"
            : "border-[color:var(--line)] hover:border-[color:var(--line-2)]"
        }`}
      >
        {/* Main row — tappable on mobile */}
        <div
          className="flex cursor-pointer items-center gap-3 px-4 py-3"
          onClick={onToggle}
        >
          <div className="min-w-0 flex-1">
            {/* Top line: name + days-until badge */}
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium text-[color:var(--ink)]">
                {birthday.name}
              </span>
              <span
                className={`ml-auto shrink-0 inline-flex items-center px-1.5 py-0.5 text-[10.5px] uppercase tracking-[1.5px] font-mono ${daysUntilBadgeClass(birthday.days_until)}`}
              >
                {daysUntilLabel(birthday.days_until)}
              </span>
            </div>

            {/* Bottom line: date + turning age */}
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-[color:var(--ink-3)]">
              <span>{formattedDate}</span>
              {birthday.turning_age != null && (
                <>
                  <span>·</span>
                  <span className="text-[color:var(--accent-3)]">
                    turns {birthday.turning_age}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Expanded action panel */}
        {expandedActions}
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

      <EditBirthdayDialog
        birthday={birthday}
        open={editOpen}
        onOpenChange={setEditOpen}
      />
    </>
  );
}

// -- Main list component --

interface BirthdayListProps {
  birthdays: Birthday[];
  isLoading: boolean;
  error: Error | null;
  /** Optional cap on how many birthdays to render. Undefined = no limit (default). */
  limit?: number;
}

export function BirthdayList({
  birthdays,
  isLoading,
  error,
  limit,
}: BirthdayListProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const shown =
    typeof limit === "number" ? birthdays.slice(0, limit) : birthdays;

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="h-14 animate-pulse border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center text-[color:var(--danger)]">
        Failed to load birthdays
      </div>
    );
  }

  if (birthdays.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center border-[1.5px] border-[color:var(--line)] bg-[color:var(--bg-2)]">
          <Cake className="h-5 w-5 text-[color:var(--ink-3)]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[color:var(--ink-2)]">
            No birthdays
          </p>
          <p className="mt-1 text-xs text-[color:var(--ink-3)]">
            Use the form above to add your first birthday
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {shown.map((b) => (
        <BirthdayRow
          key={b.id}
          birthday={b}
          expanded={expandedId === b.id}
          onToggle={() => setExpandedId(expandedId === b.id ? null : b.id)}
        />
      ))}
    </div>
  );
}
