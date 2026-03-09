"use client";

import { useState, useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/ui/date-picker";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import { useCreateCalendarEvent, useUpdateCalendarEvent } from "@/hooks/use-calendar";
import type { CalendarEvent, CalendarEventCreate } from "@/types/calendar";
import type { Visibility } from "@/types/task";

interface EventDialogProps {
  open: boolean;
  onClose: () => void;
  prefillDate?: Date | null;
  event?: CalendarEvent | null;
}

function toLocalDatetimeValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function roundToNextHour(date: Date): Date {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function EventDialog({ open, onClose, prefillDate, event }: EventDialogProps) {
  const isEditing = !!event;
  const now = prefillDate || new Date();
  const startDefault = roundToNextHour(now);
  const endDefault = new Date(startDefault.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [allDay, setAllDay] = useState(event?.all_day ?? false);
  const [startTime, setStartTime] = useState(
    event ? event.start_time.slice(0, 16) : toLocalDatetimeValue(startDefault)
  );
  const [endTime, setEndTime] = useState(
    event ? event.end_time.slice(0, 16) : toLocalDatetimeValue(endDefault)
  );
  const [visibility, setVisibility] = useState<Visibility>(event?.visibility ?? "family");
  const [error, setError] = useState("");

  const createEvent = useCreateCalendarEvent();
  const updateEvent = useUpdateCalendarEvent();
  const isPending = createEvent.isPending || updateEvent.isPending;

  // Reset form when dialog opens with new prefillDate
  useEffect(() => {
    if (!isEditing && prefillDate) {
      const s = roundToNextHour(prefillDate);
      const e = new Date(s.getTime() + 60 * 60 * 1000);
      setStartTime(toLocalDatetimeValue(s));
      setEndTime(toLocalDatetimeValue(e));
    }
  }, [prefillDate, isEditing]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!title.trim()) { setError("Title is required"); return; }
    if (!allDay && new Date(endTime) <= new Date(startTime)) {
      setError("End time must be after start time");
      return;
    }

    const payload: CalendarEventCreate = {
      title: title.trim(),
      description: description.trim() || undefined,
      location: location.trim() || undefined,
      all_day: allDay,
      start_time: allDay
        ? new Date(startTime.split("T")[0]).toISOString()
        : new Date(startTime).toISOString(),
      end_time: allDay
        ? new Date(endTime.split("T")[0]).toISOString()
        : new Date(endTime).toISOString(),
      visibility,
    };

    try {
      if (isEditing && event) {
        await updateEvent.mutateAsync({ id: event.id, data: payload });
      } else {
        await createEvent.mutateAsync(payload);
      }
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save event");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        className="relative z-10 bg-[--surface] border border-[--border] rounded-lg shadow-xl w-full max-w-[480px] mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[--border]">
          <h2 className="text-base font-semibold text-[--text-primary]">
            {isEditing ? "Edit Event" : "New Event"}
          </h2>
          <button onClick={onClose} className="text-[--text-tertiary] hover:text-[--text-primary] transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Event title"
              autoFocus
            />
          </div>

          {/* All-day toggle */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="all-day"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="w-4 h-4 accent-[--accent]"
            />
            <Label htmlFor="all-day" className="cursor-pointer">All-day event</Label>
          </div>

          {allDay ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start date</Label>
                <DatePicker
                  value={startTime.split("T")[0]}
                  onChange={(v) => setStartTime(v ? v + "T00:00" : "")}
                  placeholder="Start date"
                />
              </div>
              <div className="space-y-1.5">
                <Label>End date</Label>
                <DatePicker
                  value={endTime.split("T")[0]}
                  onChange={(v) => setEndTime(v ? v + "T23:59" : "")}
                  placeholder="End date"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Start</Label>
                <DateTimePicker
                  value={startTime}
                  onChange={setStartTime}
                  placeholder="Start date & time"
                />
              </div>
              <div className="space-y-1.5">
                <Label>End</Label>
                <DateTimePicker
                  value={endTime}
                  onChange={setEndTime}
                  placeholder="End date & time"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Optional location"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="visibility">Visibility</Label>
            <Select
              id="visibility"
              value={visibility}
              onChange={(e) => setVisibility(e.target.value as Visibility)}
            >
              <option value="family">👨‍👩‍👧 Family</option>
              <option value="private">🔒 Private</option>
            </Select>
          </div>

          {error && <p className="text-sm text-[--danger]">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEditing ? "Save Changes" : "Create Event"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
