"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Calendar, Globe, Edit, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EventNotes } from "@/components/calendar/event-notes";
import { EventDialog } from "@/components/calendar/event-dialog";
import { LinkedTasks } from "@/components/calendar/linked-tasks";
import { useCalendarEvent, useDeleteCalendarEvent } from "@/hooks/use-calendar";
import { toast } from "sonner";

export default function EventDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const eventId = Number(id);

  const { data: event, isLoading } = useCalendarEvent(eventId);
  const deleteEvent = useDeleteCalendarEvent();
  const [showEditDialog, setShowEditDialog] = useState(false);

  const handleDelete = async () => {
    if (!confirm("Delete this event?")) return;
    try {
      await deleteEvent.mutateAsync(eventId);
      toast.success("Event deleted");
      router.push("/calendar");
    } catch {
      toast.error("Failed to delete event");
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full text-[--text-tertiary] text-sm">
        Loading...
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3">
        <p className="text-[--text-secondary]">Event not found.</p>
        <Button variant="ghost" onClick={() => router.push("/calendar")}>
          <ArrowLeft size={14} className="mr-1" /> Back to Calendar
        </Button>
      </div>
    );
  }

  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);

  const formatDateTime = (d: Date) =>
    event.all_day
      ? d.toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
      : d.toLocaleString("en", { weekday: "short", month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Back */}
      <button
        onClick={() => router.push("/calendar")}
        className="flex items-center gap-1.5 text-sm text-[--text-secondary] hover:text-[--text-primary] transition-colors"
      >
        <ArrowLeft size={14} />
        Calendar
      </button>

      {/* Title + actions */}
      <div className="flex items-start justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[--text-primary] leading-tight">{event.title}</h1>
        <div className="flex gap-1.5 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={() => setShowEditDialog(true)}>
            <Edit size={13} className="mr-1" /> Edit
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            disabled={deleteEvent.isPending}
            className="text-[--danger] border-[--danger]/30 hover:bg-[--danger]/10"
          >
            <Trash2 size={13} className="mr-1" /> Delete
          </Button>
        </div>
      </div>

      {/* Meta */}
      <div className="bg-[--surface] border border-[--border] rounded-lg p-4 space-y-3">
        <div className="flex items-center gap-2.5 text-sm text-[--text-primary]">
          <Clock size={15} className="text-[--text-secondary] flex-shrink-0" />
          <div>
            <div>{formatDateTime(startDate)}</div>
            {!event.all_day && (
              <div className="text-[--text-secondary] text-xs mt-0.5">
                to {endDate.toLocaleTimeString("en", { hour: "2-digit", minute: "2-digit" })}
              </div>
            )}
          </div>
        </div>

        {event.location && (
          <div className="flex items-center gap-2.5 text-sm text-[--text-primary]">
            <MapPin size={15} className="text-[--text-secondary] flex-shrink-0" />
            <span>{event.location}</span>
          </div>
        )}

        <div className="flex items-center gap-2.5 text-sm">
          <Globe size={15} className="text-[--text-secondary] flex-shrink-0" />
          <span className="text-[--text-secondary]">
            Source:{" "}
            <span className={event.source === "google" ? "text-[--accent]" : "text-[--text-primary]"}>
              {event.source === "google" ? "Google Calendar" : "Local"}
            </span>
            {event.synced_at && (
              <span className="text-[--text-tertiary] ml-2">
                · synced {new Date(event.synced_at).toLocaleString()}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="space-y-1.5">
          <h3 className="text-xs font-medium text-[--text-secondary] uppercase tracking-wide">Description</h3>
          <p className="text-sm text-[--text-primary] whitespace-pre-wrap leading-relaxed">
            {event.description}
          </p>
        </div>
      )}

      {/* Linked Tasks */}
      <div className="border-t border-[--border] pt-6">
        <LinkedTasks eventId={event.id} />
      </div>

      {/* Notes */}
      <div className="border-t border-[--border] pt-6">
        <EventNotes eventId={event.id} notes={event.notes} />
      </div>

      {/* Edit dialog */}
      {showEditDialog && (
        <EventDialog
          open={showEditDialog}
          onClose={() => setShowEditDialog(false)}
          event={event}
        />
      )}
    </div>
  );
}
