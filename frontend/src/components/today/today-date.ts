export function todayBounds(): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
} {
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    0,
    0,
    0,
    0
  );
  const end = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999
  );
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

export function isSameLocalDay(iso: string | null | undefined, ref: Date = new Date()): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  return (
    d.getFullYear() === ref.getFullYear() &&
    d.getMonth() === ref.getMonth() &&
    d.getDate() === ref.getDate()
  );
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function todayStart(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function thisWeekBounds(now: Date = new Date()): {
  start: Date;
  end: Date;
  startIso: string;
  endIso: string;
} {
  // Monday 00:00 → Sunday 23:59:59.999 in local TZ.
  // JS getDay(): Sun=0, Mon=1, …, Sat=6. Offset to Monday:
  //   Sun(0) → 6 days back, Mon(1) → 0, …, Sat(6) → 5.
  const daysSinceMonday = (now.getDay() + 6) % 7;
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - daysSinceMonday,
    0,
    0,
    0,
    0
  );
  const end = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + 6,
    23,
    59,
    59,
    999
  );
  return {
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}
