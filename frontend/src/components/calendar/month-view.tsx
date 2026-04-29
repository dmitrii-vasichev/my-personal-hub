"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import type { CalendarEvent } from "@/types/calendar";
import { EventPill } from "./event-pill";

interface MonthViewProps {
  year: number;
  month: number; // 0-indexed
  events: CalendarEvent[];
  onDateClick: (date: Date) => void;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Adjust: Monday = 0 (getDay() returns 0=Sun, need to shift)
  const startDow = (firstDay.getDay() + 6) % 7; // Mon=0..Sun=6
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= lastDay.getDate(); d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
}

function eventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    const start = new Date(e.start_time);
    const end = new Date(e.end_time);
    return start <= day && day <= end || isSameDay(start, day);
  });
}

export function MonthView({ year, month, events, onDateClick }: MonthViewProps) {
  const router = useRouter();
  const today = new Date();
  const grid = useMemo(() => getMonthGrid(year, month), [year, month]);

  return (
    <div className="flex flex-col h-full">
      {/* Weekday headers */}
      <div className="grid grid-cols-7 border-b border-[--border]">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="py-2 text-center text-xs font-medium text-[--text-secondary] uppercase tracking-wide"
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: "minmax(100px, 1fr)" }}>
        {grid.map((day, i) => {
          if (!day) {
            return (
              <div
                key={`empty-${i}`}
                className="border-b border-r border-[--border] bg-[--surface]/30"
              />
            );
          }

          const isToday = isSameDay(day, today);
          const dayEvents = eventsForDay(events, day);

          return (
            <div
              key={day.toISOString()}
              className="border-b border-r border-[--border] p-1.5 cursor-pointer hover:bg-[--surface-hover] transition-colors min-h-[100px]"
              onClick={() => onDateClick(day)}
            >
              <div className="flex items-center justify-center mb-1">
                <span
                  className={`text-sm w-6 h-6 flex items-center justify-center rounded-full font-medium ${
                    isToday
                      ? "bg-[--accent] text-[var(--primary-foreground)]"
                      : "text-[--text-secondary]"
                  }`}
                >
                  {day.getDate()}
                </span>
              </div>
              <div className="space-y-0.5">
                {dayEvents.slice(0, 3).map((event) => (
                  <EventPill
                    key={event.id}
                    event={event}
                    onClick={(e) => {
                      router.push(`/calendar/${e.id}`);
                    }}
                  />
                ))}
                {dayEvents.length > 3 && (
                  <p className="text-xs text-[--text-tertiary] px-1.5">
                    +{dayEvents.length - 3} more
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
