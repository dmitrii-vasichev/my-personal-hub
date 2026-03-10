"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Plus, RefreshCw, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonthView } from "@/components/calendar/month-view";
import { WeekView } from "@/components/calendar/week-view";
import { EventDialog } from "@/components/calendar/event-dialog";
import { GoogleConnect } from "@/components/calendar/google-connect";
import { useCalendarEvents } from "@/hooks/use-calendar";
import { toast } from "sonner";

type ViewMode = "month" | "week";

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = (day + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatMonthTitle(year: number, month: number) {
  return new Date(year, month).toLocaleDateString("en", { month: "long", year: "numeric" });
}

function formatWeekTitle(weekStart: Date) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);
  const startStr = weekStart.toLocaleDateString("en", { month: "short", day: "numeric" });
  const endStr = weekEnd.toLocaleDateString("en", { month: "short", day: "numeric", year: "numeric" });
  return `${startStr} – ${endStr}`;
}

export default function CalendarPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Handle OAuth callback result (redirect from backend)
  useEffect(() => {
    const googleStatus = searchParams.get("google");
    if (!googleStatus) return;

    if (googleStatus === "connected") {
      toast.success("Google Calendar connected successfully");
    } else if (googleStatus === "error") {
      const reason = searchParams.get("reason") || "unknown";
      const detail = searchParams.get("detail") || "";
      toast.error(`Failed to connect Google Calendar: ${reason}`, {
        description: detail || undefined,
        duration: 10000,
      });
    }

    // Clean up URL params
    router.replace("/calendar");
  }, [searchParams, router]);

  const today = new Date();
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentWeekStart, setCurrentWeekStart] = useState(() => getWeekStart(today));
  const [showDialog, setShowDialog] = useState(false);
  const [prefillDate, setPrefillDate] = useState<Date | null>(null);

  // Fetch events for visible range
  const rangeStart =
    viewMode === "month"
      ? new Date(currentYear, currentMonth, 1).toISOString()
      : currentWeekStart.toISOString();
  const rangeEnd =
    viewMode === "month"
      ? new Date(currentYear, currentMonth + 1, 0, 23, 59, 59).toISOString()
      : (() => {
          const e = new Date(currentWeekStart);
          e.setDate(e.getDate() + 6);
          e.setHours(23, 59, 59);
          return e.toISOString();
        })();

  const { data: events = [], isLoading } = useCalendarEvents({ start: rangeStart, end: rangeEnd });

  // Navigation
  const goToPrev = () => {
    if (viewMode === "month") {
      if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(y => y - 1); }
      else setCurrentMonth(m => m - 1);
    } else {
      const prev = new Date(currentWeekStart);
      prev.setDate(prev.getDate() - 7);
      setCurrentWeekStart(prev);
    }
  };

  const goToNext = () => {
    if (viewMode === "month") {
      if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(y => y + 1); }
      else setCurrentMonth(m => m + 1);
    } else {
      const next = new Date(currentWeekStart);
      next.setDate(next.getDate() + 7);
      setCurrentWeekStart(next);
    }
  };

  const goToToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
    setCurrentWeekStart(getWeekStart(now));
  };

  const handleDateClick = (date: Date) => {
    setPrefillDate(date);
    setShowDialog(true);
  };

  const handleSlotClick = (date: Date, hour: number) => {
    const d = new Date(date);
    d.setHours(hour, 0, 0, 0);
    setPrefillDate(d);
    setShowDialog(true);
  };

  const title = viewMode === "month"
    ? formatMonthTitle(currentYear, currentMonth)
    : formatWeekTitle(currentWeekStart);

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h1 className="text-xl font-semibold text-[--text-primary] flex items-center gap-2">
          <Calendar size={20} className="text-[--text-secondary]" />
          Meetings
        </h1>
        <div className="flex items-center gap-2">
          <GoogleConnect />
          <Button
            size="sm"
            onClick={() => {
              setShowDialog(true);
              setPrefillDate(null);
            }}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Event
          </Button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={goToPrev}>
            <ChevronLeft size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={goToToday} className="px-3">
            Today
          </Button>
          <Button variant="ghost" size="sm" onClick={goToNext}>
            <ChevronRight size={16} />
          </Button>
        </div>

        <h2 className="text-base font-medium text-[--text-primary] min-w-[200px]">{title}</h2>

        {/* View toggle */}
        <div className="ml-auto flex items-center gap-1 bg-[--surface] border border-[--border] rounded-md p-0.5">
          {(["month", "week"] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 text-xs font-medium rounded transition-colors capitalize ${
                viewMode === mode
                  ? "bg-[--accent] text-white"
                  : "text-[--text-secondary] hover:text-[--text-primary]"
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* Calendar view */}
      <div className="flex-1 min-h-0 border border-[--border] rounded-lg overflow-hidden bg-[--surface]">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[--text-tertiary] text-sm">
            Loading events...
          </div>
        ) : viewMode === "month" ? (
          <MonthView
            year={currentYear}
            month={currentMonth}
            events={events}
            onDateClick={handleDateClick}
          />
        ) : (
          <WeekView
            weekStart={currentWeekStart}
            events={events}
            onSlotClick={handleSlotClick}
          />
        )}
      </div>

      {/* Create/Edit event dialog */}
      {showDialog && (
        <EventDialog
          open={showDialog}
          onClose={() => { setShowDialog(false); setPrefillDate(null); }}
          prefillDate={prefillDate}
        />
      )}
    </div>
  );
}
