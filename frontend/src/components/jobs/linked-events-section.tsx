"use client";

import { useState } from "react";
import { Calendar, Link2, Plus, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogPortal, DialogBackdrop, DialogPopup, DialogTitle, DialogClose } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useJobLinkedEvents,
  useLinkJobToEvent,
  useUnlinkJobFromEvent,
} from "@/hooks/use-job-links";
import { useCalendarEvents } from "@/hooks/use-calendar";

interface LinkedEventsSectionProps {
  jobId: number;
}

function formatEventTime(start: string, end: string): string {
  const startDate = new Date(start);
  const endDate = new Date(end);
  const dateStr = startDate.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const startTime = startDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = endDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dateStr}, ${startTime} – ${endTime}`;
}

export function LinkedEventsSection({ jobId }: LinkedEventsSectionProps) {
  const { data: linkedEvents = [], isLoading } = useJobLinkedEvents(jobId);
  const linkMutation = useLinkJobToEvent(jobId);
  const unlinkMutation = useUnlinkJobFromEvent(jobId);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { data: allEvents = [] } = useCalendarEvents(dialogOpen ? {} : {});

  const linkedIds = new Set(linkedEvents.map((e) => e.id));
  const filteredEvents = allEvents
    .filter((e) => !linkedIds.has(e.id))
    .filter(
      (e) =>
        !search || e.title.toLowerCase().includes(search.toLowerCase())
    );

  const handleLink = async (eventId: number) => {
    await linkMutation.mutateAsync(eventId);
  };

  const handleUnlink = async (eventId: number) => {
    await unlinkMutation.mutateAsync(eventId);
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h3 className="text-xs font-medium uppercase tracking-wider text-[var(--text-secondary)]">
            Linked Events
          </h3>
          {linkedEvents.length > 0 && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-medium bg-[var(--surface-hover)] text-[var(--text-tertiary)]">
              {linkedEvents.length}
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
          Link Event
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="h-4 w-4 animate-spin text-[var(--text-tertiary)]" />
        </div>
      ) : linkedEvents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[var(--border)] p-4 text-center">
          <Link2 className="mx-auto mb-1.5 h-4 w-4 text-[var(--text-tertiary)]" />
          <p className="text-xs text-[var(--text-tertiary)]">No events linked</p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {linkedEvents.map((event) => (
            <div
              key={event.id}
              className="flex items-center justify-between gap-2 rounded-md border border-[var(--border)] bg-[var(--surface)] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                <div className="min-w-0">
                  <span className="text-sm text-[var(--text-primary)] truncate block">
                    {event.title}
                  </span>
                  <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                    {formatEventTime(event.start_time, event.end_time)}
                  </span>
                </div>
              </div>
              <Tooltip content="Unlink event">
                <button
                  onClick={() => handleUnlink(event.id)}
                  className="shrink-0 p-1 rounded text-[var(--text-tertiary)] hover:text-[var(--destructive)] hover:bg-[var(--destructive-muted)] transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}

      {/* Link Event Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogPortal>
          <DialogBackdrop />
          <DialogPopup className="w-full max-w-md p-6">
            <DialogClose />
            <DialogTitle className="mb-4">Link Event</DialogTitle>
            <Input
              placeholder="Search events..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-3"
            />
            <div className="max-h-64 overflow-y-auto flex flex-col gap-1">
              {filteredEvents.length === 0 ? (
                <p className="text-sm text-[var(--text-tertiary)] text-center py-4">
                  No events found
                </p>
              ) : (
                filteredEvents.map((event) => (
                  <button
                    key={event.id}
                    onClick={() => {
                      handleLink(event.id);
                      setDialogOpen(false);
                      setSearch("");
                    }}
                    className="flex items-center gap-2 px-3 py-2 rounded-md text-left hover:bg-[var(--surface-hover)] transition-colors cursor-pointer"
                  >
                    <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--text-tertiary)]" />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-[var(--text-primary)] truncate block">
                        {event.title}
                      </span>
                      <span className="text-[10px] font-mono text-[var(--text-tertiary)]">
                        {formatEventTime(event.start_time, event.end_time)}
                      </span>
                    </div>
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
