"use client";

import { useDashboardSummary } from "@/hooks/use-dashboard";
import { SummaryCards } from "./summary-cards";

export function DashboardClient() {
  const { data, isLoading } = useDashboardSummary();

  return <SummaryCards data={data} isLoading={isLoading} />;
}
