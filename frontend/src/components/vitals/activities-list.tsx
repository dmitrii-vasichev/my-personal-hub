"use client";

import { useState, useMemo } from "react";
import {
  Footprints,
  Bike,
  Dumbbell,
  Waves,
  Mountain,
  Activity,
  ChevronDown,
} from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import type { VitalsActivity } from "@/types/vitals";

interface ActivitiesListProps {
  activities: VitalsActivity[] | undefined;
  isLoading: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  running: <Footprints className="h-4 w-4" />,
  trail_running: <Footprints className="h-4 w-4" />,
  cycling: <Bike className="h-4 w-4" />,
  strength_training: <Dumbbell className="h-4 w-4" />,
  swimming: <Waves className="h-4 w-4" />,
  hiking: <Mountain className="h-4 w-4" />,
  walking: <Footprints className="h-4 w-4" />,
};

function getActivityIcon(type: string): React.ReactNode {
  const key = type.toLowerCase().replace(/\s+/g, "_");
  return ACTIVITY_ICONS[key] ?? <Activity className="h-4 w-4" />;
}

function formatDuration(seconds: number | null): string {
  if (seconds == null) return "\u2014";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

function formatDistance(meters: number | null): string {
  if (meters == null) return "\u2014";
  if (meters < 1000) return `${Math.round(meters)}m`;
  return `${(meters / 1000).toFixed(1)} km`;
}

function ActivitySkeleton() {
  return (
    <div className="flex items-center gap-3 py-3">
      <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3.5 w-32 rounded bg-muted animate-pulse" />
        <div className="h-3 w-48 rounded bg-muted animate-pulse" />
      </div>
    </div>
  );
}

export function ActivitiesList({
  activities,
  isLoading,
  hasMore,
  onLoadMore,
}: ActivitiesListProps) {
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const activityTypes = useMemo(() => {
    if (!activities) return [];
    const types = new Set(activities.map((a) => a.activity_type));
    return Array.from(types).sort();
  }, [activities]);

  const filtered = useMemo(() => {
    if (!activities) return [];
    if (typeFilter === "all") return activities;
    return activities.filter((a) => a.activity_type === typeFilter);
  }, [activities, typeFilter]);

  return (
    <div className="rounded-xl border border-border-subtle bg-card p-6" data-testid="activities-list">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Activities</h3>
        {activityTypes.length > 1 && (
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-md border border-border bg-surface px-2 py-1 text-xs text-foreground cursor-pointer"
          >
            <option value="all">All types</option>
            {activityTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        )}
      </div>

      {isLoading ? (
        <div className="divide-y divide-border-subtle">
          {Array.from({ length: 3 }).map((_, i) => (
            <ActivitySkeleton key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
          <Activity className="h-6 w-6 text-muted-foreground opacity-40" />
          <p className="text-xs text-muted-foreground">No activities found</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-border-subtle">
            {filtered.map((activity) => (
              <div key={activity.id} className="flex items-center gap-3 py-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-muted-foreground">
                  {getActivityIcon(activity.activity_type)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {activity.name ?? activity.activity_type.replace(/_/g, " ")}
                  </p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{formatDuration(activity.duration_seconds)}</span>
                    {activity.distance_m != null && (
                      <span>{formatDistance(activity.distance_m)}</span>
                    )}
                    {activity.avg_hr != null && (
                      <span>{activity.avg_hr} bpm</span>
                    )}
                    {activity.calories != null && (
                      <span>{activity.calories} cal</span>
                    )}
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {format(new Date(activity.start_time), "MMM d")}
                </span>
              </div>
            ))}
          </div>
          {hasMore && onLoadMore && (
            <div className="mt-3 flex justify-center">
              <Button variant="ghost" size="sm" onClick={onLoadMore} className="text-xs">
                <ChevronDown className="mr-1 h-3 w-3" />
                Load more
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
