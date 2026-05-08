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

function getDateAxisTicks(dates: string[], period: Period): string[] | undefined {
  if (period !== "30d") {
    return undefined;
  }

  const monthStartIndexes = new Set(
    dates
      .map((date, index) => (parseChartDate(date).getDate() === 1 ? index : -1))
      .filter((index) => index >= 0)
  );

  return dates.filter((_, index) => {
    if (index === 0 || index === dates.length - 1) {
      return true;
    }

    if (monthStartIndexes.has(index)) {
      return true;
    }

    if (monthStartIndexes.has(index - 1) || monthStartIndexes.has(index + 1)) {
      return false;
    }

    return index % 2 === 0;
  });
}

export function getDateAxisProps(period: Period, dates: string[] = []) {
  const isThirtyDays = period === "30d";
  const isNinetyDays = period === "90d";
  const ticks = getDateAxisTicks(dates, period);

  return {
    dataKey: "date",
    angle: 0,
    interval: isNinetyDays ? 6 : 0,
    minTickGap: isNinetyDays ? 16 : isThirtyDays ? 8 : 4,
    height: 28,
    tickMargin: 8,
    ticks,
    tick: {
      fontSize: isThirtyDays ? 10 : isNinetyDays ? 10 : 11,
      fill: "var(--text-tertiary)",
    },
    tickFormatter: (value: string | number, index: number) =>
      formatDateAxisTick(value, period, index),
    tickLine: false,
    axisLine: false,
  };
}
