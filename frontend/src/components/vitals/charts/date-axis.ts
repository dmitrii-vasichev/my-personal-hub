"use client";

import { format, isValid, parseISO } from "date-fns";
import type { Period } from "../period-selector";

function parseChartDate(value: string): Date {
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : new Date(value);
}

export function formatDateAxisTick(value: string | number, period: Period, index = 0): string {
  const date = parseChartDate(String(value));

  if (!isValid(date)) {
    return String(value);
  }

  if (period === "7d") {
    return format(date, "MMM d");
  }

  if (period === "30d") {
    if (index === 0 || date.getDate() === 1) {
      return format(date, "MMM d");
    }

    return format(date, "d");
  }

  return format(date, "MM/dd");
}

export function getDateAxisProps(period: Period) {
  const isThirtyDays = period === "30d";
  const isNinetyDays = period === "90d";

  return {
    dataKey: "date",
    angle: 0,
    interval: isNinetyDays ? 6 : 0,
    minTickGap: isNinetyDays ? 16 : isThirtyDays ? 0 : 4,
    height: 28,
    tickMargin: 8,
    tick: {
      fontSize: isThirtyDays ? 9 : isNinetyDays ? 10 : 11,
      fill: "var(--text-tertiary)",
    },
    tickFormatter: (value: string | number, index: number) =>
      formatDateAxisTick(value, period, index),
    tickLine: false,
    axisLine: false,
  };
}
