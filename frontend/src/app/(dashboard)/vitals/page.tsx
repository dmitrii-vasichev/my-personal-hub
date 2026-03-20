"use client";

import { useState, useCallback } from "react";
import { RefreshCw, Heart, AlertCircle } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DemoModeBadge } from "@/components/ui/demo-mode-badge";
import { useAuth } from "@/lib/auth";
import {
  useVitalsConnection,
  useVitalsToday,
  useVitalsBriefing,
  useGenerateBriefing,
  useSyncVitals,
  useVitalsActivities,
} from "@/hooks/use-vitals";
import { TodaySummary } from "@/components/vitals/today-summary";
import { BriefingCard } from "@/components/vitals/briefing-card";
import { ChartsSection } from "@/components/vitals/charts-section";
import { ActivitiesList } from "@/components/vitals/activities-list";

const PAGE_SIZE = 20;

export default function VitalsPage() {
  const { isDemo } = useAuth();
  const [activityLimit, setActivityLimit] = useState(PAGE_SIZE);

  const { data: connection, isLoading: connectionLoading } = useVitalsConnection();
  const { data: today, isLoading: todayLoading } = useVitalsToday();
  const { data: briefing, isLoading: briefingLoading } = useVitalsBriefing();
  const { data: activities, isLoading: activitiesLoading } = useVitalsActivities(
    undefined,
    undefined,
    activityLimit,
    0
  );

  const generateBriefing = useGenerateBriefing();
  const syncVitals = useSyncVitals();

  const handleLoadMore = useCallback(() => {
    setActivityLimit((prev) => prev + PAGE_SIZE);
  }, []);

  const isConnected = connection?.connected ?? false;

  // Loading state for connection check
  if (connectionLoading) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6">
          <div className="h-6 w-32 rounded bg-muted animate-pulse mb-2" />
          <div className="h-4 w-64 rounded bg-muted animate-pulse" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state — not connected
  if (!isConnected) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-6">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-foreground">Vitals</h1>
          <p className="text-sm text-muted-foreground">
            Garmin health metrics & AI insights
          </p>
        </div>
        <div
          className="flex flex-col items-center justify-center gap-4 rounded-xl border border-border-subtle p-12 text-center"
          data-testid="vitals-not-connected"
        >
          <AlertCircle className="h-10 w-10 text-[var(--accent-amber)]" />
          <h2 className="text-lg font-semibold text-foreground">
            Garmin not connected
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            Connect your Garmin account in Settings to sync health data, view
            trends, and get AI-powered daily briefings.
          </p>
          <Link href="/settings">
            <Button size="sm">Connect Garmin in Settings</Button>
          </Link>
        </div>
      </div>
    );
  }

  const lastSyncAgo = connection?.last_sync_at
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
    : null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
            <Heart className="h-5 w-5 text-[var(--destructive)]" />
            Vitals
          </h1>
          <p className="text-sm text-muted-foreground">
            Garmin health metrics & AI insights
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastSyncAgo && (
            <span className="text-xs text-muted-foreground">
              Synced {lastSyncAgo}
            </span>
          )}
          {isDemo ? (
            <DemoModeBadge feature="Sync" description="Not available in demo mode" compact />
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => syncVitals.mutate()}
              disabled={syncVitals.isPending}
              className="h-8 text-xs"
            >
              {syncVitals.isPending ? (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              )}
              Sync now
            </Button>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <TodaySummary
        metrics={today?.metrics}
        sleep={today?.sleep}
        isLoading={todayLoading}
      />

      {/* AI Briefing */}
      <BriefingCard
        briefing={briefing}
        isLoading={briefingLoading}
        onGenerate={() => generateBriefing.mutate()}
        isGenerating={generateBriefing.isPending}
      />

      {/* Charts */}
      <ChartsSection />

      {/* Activities */}
      <ActivitiesList
        activities={activities}
        isLoading={activitiesLoading}
        hasMore={(activities?.length ?? 0) >= activityLimit}
        onLoadMore={handleLoadMore}
      />
    </div>
  );
}
