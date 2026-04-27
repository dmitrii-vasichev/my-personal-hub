"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEvent } from "@/types/calendar";
import { EventPill } from "./event-pill";

interface WeekViewProps {
  weekStart: Date; // Monday of the week
  events: CalendarEvent[];
  onSlotClick: (date: Date, hour: number) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const HOUR_HEIGHT = 60; // px per hour
const DAY_START = 6; // visible from 6:00
const DAY_END = 24; // visible to midnight

function getWeekDays(weekStart: Date): Date[] {
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function getEventPosition(event: CalendarEvent, dayStart: Date): { top: number; height: number } | null {
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);
  if (!isSameDay(start, dayStart)) return null;
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  const top = ((startMinutes - DAY_START * 60) / 60) * HOUR_HEIGHT;
  const height = Math.max(((endMinutes - startMinutes) / 60) * HOUR_HEIGHT, 20);
  return { top, height };
}

export function WeekView({ weekStart, events, onSlotClick }: WeekViewProps) {
  const router = useRouter();
  const today = new Date();
  const days = useMemo(() => getWeekDays(weekStart), [weekStart]);

  const allDayEvents = events.filter((e) => e.all_day);
  const timedEvents = events.filter((e) => !e.all_day);

  const visibleHours = HOURS.slice(DAY_START, DAY_END);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header: day names */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[--border] flex-shrink-0">
        <div /> {/* Time gutter */}
        {days.map((day) => {
          const isToday = isSameDay(day, today);
          return (
            <div key={day.toISOString()} className="py-2 text-center border-l border-[--border]">
              <span className="text-xs text-[--text-secondary] uppercase">
                {day.toLocaleDateString("en", { weekday: "short" })}
              </span>
              <div
                className={`text-sm font-medium mx-auto mt-0.5 w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? "bg-[--accent] text-white" : "text-[--text-primary]"
                }`}
              >
                {day.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* All-day events row */}
      {allDayEvents.length > 0 && (
        <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-[--border] flex-shrink-0">
          <div className="text-xs text-[--text-tertiary] p-1 text-right">all-day</div>
          {days.map((day) => (
            <div key={day.toISOString()} className="p-1 border-l border-[--border]">
              {allDayEvents
                .filter((e) => isSameDay(new Date(e.start_time), day))
                .map((e) => (
                  <EventPill key={e.id} event={e} onClick={(ev) => router.push(`/calendar/${ev.id}`)} />
                ))}
            </div>
          ))}
        </div>
      )}

      {/* Scrollable time grid */}
      <div className="flex-1 overflow-y-auto">
        <div
          className="grid grid-cols-[60px_repeat(7,1fr)] relative"
          style={{ height: `${(DAY_END - DAY_START) * HOUR_HEIGHT}px` }}
        >
          {/* Hour labels */}
          <div className="flex flex-col">
            {visibleHours.map((h) => (
              <div
                key={h}
                className="border-b border-[--border] text-xs text-[--text-tertiary] text-right pr-2 pt-0.5"
                style={{ height: `${HOUR_HEIGHT}px` }}
              >
                {h === 0 ? "" : `${String(h).padStart(2, "0")}:00`}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day) => (
            <div
              key={day.toISOString()}
              className="relative border-l border-[--border]"
              style={{ height: `${(DAY_END - DAY_START) * HOUR_HEIGHT}px` }}
            >
              {/* Hour slots for click */}
              {visibleHours.map((h) => (
                <div
                  key={h}
                  className="border-b border-[--border] hover:bg-[--surface-hover] cursor-pointer transition-colors"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  onClick={() => onSlotClick(day, h)}
                />
              ))}

              {/* Timed events */}
              {timedEvents.map((event) => {
                const pos = getEventPosition(event, day);
                if (!pos) return null;
                return (
                  <button
                    key={event.id}
                    className="absolute left-1 right-1 rounded text-xs px-1.5 py-0.5 text-left overflow-hidden bg-[--accent-muted] text-[--accent] border border-[--accent]/30 hover:opacity-80 transition-opacity"
                    style={{ top: `${pos.top}px`, height: `${pos.height}px` }}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/calendar/${event.id}`);
                    }}
                    title={event.title}
                  >
                    <div className="font-medium truncate">{event.title}</div>
                    <div className="text-[--accent]/70 text-[10px]">
                      {new Date(event.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
