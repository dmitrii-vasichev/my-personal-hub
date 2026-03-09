"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCalendarEvents } from "@/hooks/use-calendar";
import {
  useTaskLinkedEvents,
  useLinkTaskToEvent,
  useUnlinkTaskFromEvent,
} from "@/hooks/use-task-event-links";

interface Props {
  taskId: number;
}

export function LinkedEvents({ taskId }: Props) {
  const router = useRouter();
  const [showPicker, setShowPicker] = useState(false);
  const [search, setSearch] = useState("");

  const { data: linkedEvents = [], isLoading } = useTaskLinkedEvents(taskId);
  const { data: allEvents = [] } = useCalendarEvents();
  const linkEvent = useLinkTaskToEvent(taskId);
  const unlinkEvent = useUnlinkTaskFromEvent(taskId);

  const linkedIds = new Set(linkedEvents.map((e) => e.id));
  const filtered = allEvents.filter(
    (e) =>
      !linkedIds.has(e.id) &&
      e.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleLink = async (eventId: number) => {
    await linkEvent.mutateAsync(eventId);
    setShowPicker(false);
    setSearch("");
  };

  const handleUnlink = async (eventId: number) => {
    await unlinkEvent.mutateAsync(eventId);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
          Linked Events
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
            placeholder="Search events…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--accent)]"
          />
          <div className="max-h-40 overflow-y-auto flex flex-col gap-0.5">
            {filtered.length === 0 ? (
              <p className="px-2 py-1 text-xs text-[var(--text-tertiary)]">No events found</p>
            ) : (
              filtered.map((e) => (
                <button
                  key={e.id}
                  onClick={() => handleLink(e.id)}
                  className="flex items-center gap-2 rounded px-2 py-1 text-left text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
                >
                  <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                  <span className="truncate">{e.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="text-xs text-[var(--text-tertiary)]">Loading…</p>
      ) : linkedEvents.length === 0 ? (
        <p className="text-xs text-[var(--text-tertiary)]">No linked events</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {linkedEvents.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-1 rounded-full border border-[var(--border)] bg-[var(--surface)] px-2.5 py-0.5 text-xs"
            >
              <button
                onClick={() => router.push(`/calendar/${e.id}`)}
                className="text-[var(--text-primary)] hover:text-[var(--accent)]"
              >
                {e.title}
              </button>
              <button
                onClick={() => handleUnlink(e.id)}
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
