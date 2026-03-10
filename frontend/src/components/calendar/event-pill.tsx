import { Tooltip } from "@/components/ui/tooltip";
import type { CalendarEvent } from "@/types/calendar";

interface EventPillProps {
  event: CalendarEvent;
  onClick: (event: CalendarEvent) => void;
}

export function EventPill({ event, onClick }: EventPillProps) {
  const isGoogle = event.source === "google";
  return (
    <Tooltip content={event.title}>
      <button
        onClick={() => onClick(event)}
        className={`w-full text-left truncate text-xs px-1.5 py-0.5 rounded mb-0.5 transition-opacity hover:opacity-80 ${
          isGoogle
            ? "bg-[--accent-muted] text-[--accent] border border-[--accent]/20"
            : "bg-[--surface-hover] text-[--text-primary] border border-[--border]"
        }`}
      >
        {event.all_day ? null : (
          <span className="text-[--text-tertiary] mr-1 font-mono">
            {new Date(event.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {event.visibility === "private" && (
          <span className="text-[--text-tertiary] mr-0.5">🔒</span>
        )}
        {event.title}
        {event.owner_name && (
          <span className="text-[--text-tertiary] ml-1">· {event.owner_name.split(" ")[0]}</span>
        )}
      </button>
    </Tooltip>
  );
}
