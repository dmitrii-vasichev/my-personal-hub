"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  usePulseSettings,
  useUpdatePulseSettings,
  useTriggerPoll,
} from "@/hooks/use-pulse-settings";

export function PulseSettingsTab() {
  const { data: settings, isLoading } = usePulseSettings();
  const updateSettings = useUpdatePulseSettings();
  const triggerPoll = useTriggerPoll();

  const [pollingInterval, setPollingInterval] = useState("60");
  const [ttlDays, setTtlDays] = useState("30");
  const [digestSchedule, setDigestSchedule] = useState("daily");
  const [digestTime, setDigestTime] = useState("09:00");
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyJobs, setNotifyJobs] = useState(true);

  useEffect(() => {
    if (settings) {
      setPollingInterval(String(settings.polling_interval_minutes));
      setTtlDays(String(settings.message_ttl_days));
      setDigestSchedule(settings.digest_schedule);
      setDigestTime(settings.digest_time?.slice(0, 5) || "09:00");
      setNotifyDigest(settings.notify_digest_ready);
      setNotifyJobs(settings.notify_urgent_jobs);
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        polling_interval_minutes: parseInt(pollingInterval) || 60,
        message_ttl_days: parseInt(ttlDays) || 30,
        digest_schedule: digestSchedule,
        digest_time: digestTime + ":00",
        notify_digest_ready: notifyDigest,
        notify_urgent_jobs: notifyJobs,
      });
    } catch {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Loading Pulse settings...
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Pulse Configuration</h2>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => triggerPoll.mutate()}
            disabled={triggerPoll.isPending}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${triggerPoll.isPending ? "animate-spin" : ""}`} />
            {triggerPoll.isPending ? "Polling..." : "Poll Now"}
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={updateSettings.isPending}
          >
            <Save className="mr-1.5 h-3.5 w-3.5" />
            {updateSettings.isPending ? "Saving..." : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Polling Interval */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Polling Interval (minutes)
          </Label>
          <Input
            type="number"
            min="15"
            max="1440"
            value={pollingInterval}
            onChange={(e) => setPollingInterval(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Min: 15, Max: 1440 (24h)</p>
        </div>

        {/* Message TTL */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Message TTL (days)
          </Label>
          <Input
            type="number"
            min="1"
            max="365"
            value={ttlDays}
            onChange={(e) => setTtlDays(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Messages expire after this many days</p>
        </div>

        {/* Digest Schedule */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Digest Schedule
          </Label>
          <Select
            value={digestSchedule}
            onChange={(e) => setDigestSchedule((e.target as HTMLSelectElement).value)}
            className="text-sm"
          >
            <option value="daily">Daily</option>
            <option value="every_2_days">Every 2 days</option>
            <option value="weekly">Weekly</option>
          </Select>
        </div>

        {/* Digest Time */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Digest Time
          </Label>
          <Input
            type="time"
            value={digestTime}
            onChange={(e) => setDigestTime(e.target.value)}
            className="text-sm"
          />
        </div>
      </div>

      {/* Notifications */}
      <div className="space-y-3">
        <Label className="text-xs uppercase text-muted-foreground">
          Notifications
        </Label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyDigest}
            onChange={(e) => setNotifyDigest(e.target.checked)}
            className="rounded border-border accent-[var(--accent)]"
          />
          <span className="text-sm text-foreground">Notify when digest is ready</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={notifyJobs}
            onChange={(e) => setNotifyJobs(e.target.checked)}
            className="rounded border-border accent-[var(--accent)]"
          />
          <span className="text-sm text-foreground">Notify on urgent job matches</span>
        </label>
      </div>
    </section>
  );
}
