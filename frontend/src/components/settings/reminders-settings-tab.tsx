"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  usePulseSettings,
  useUpdatePulseSettings,
} from "@/hooks/use-pulse-settings";

export function RemindersSettingsTab() {
  const { data: settings, isLoading } = usePulseSettings();
  const updateSettings = useUpdatePulseSettings();

  const [repeatCount, setRepeatCount] = useState("5");
  const [repeatInterval, setRepeatInterval] = useState("5");
  const [snoozeLimit, setSnoozeLimit] = useState("5");
  const [digestEnabled, setDigestEnabled] = useState(false);
  const [digestIntervalHours, setDigestIntervalHours] = useState("3");
  const [digestStartHour, setDigestStartHour] = useState("7");
  const [digestEndHour, setDigestEndHour] = useState("22");

  // Sync form state when server settings arrive
  const [prevSettings, setPrevSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings);
    setRepeatCount(String(settings.reminder_repeat_count ?? 5));
    setRepeatInterval(String(settings.reminder_repeat_interval ?? 5));
    setSnoozeLimit(String(settings.reminder_snooze_limit ?? 5));
    setDigestEnabled(settings.digest_reminders_enabled ?? false);
    setDigestIntervalHours(String(settings.digest_reminders_interval_hours ?? 3));
    setDigestStartHour(String(settings.digest_reminders_start_hour ?? 7));
    setDigestEndHour(String(settings.digest_reminders_end_hour ?? 22));
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        reminder_repeat_count: parseInt(repeatCount) || 5,
        reminder_repeat_interval: parseInt(repeatInterval) || 5,
        reminder_snooze_limit: parseInt(snoozeLimit) || 5,
        digest_reminders_enabled: digestEnabled,
        digest_reminders_interval_hours: parseInt(digestIntervalHours) || 3,
        digest_reminders_start_hour: parseInt(digestStartHour) || 7,
        digest_reminders_end_hour: parseInt(digestEndHour) || 22,
      });
    } catch {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Loading action settings...
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Action Defaults
        </h2>
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateSettings.isPending}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {updateSettings.isPending ? "Saving..." : "Save"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        These settings control how scheduled actions nag you and how many times
        you can snooze before quick-snooze is disabled.
      </p>

      <div className="grid grid-cols-2 gap-4">
        {/* Repeat Count */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Repeat Count
          </Label>
          <Input
            type="number"
            min="1"
            max="50"
            value={repeatCount}
            onChange={(e) => setRepeatCount(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            How many times to send a notification (1-50)
          </p>
        </div>

        {/* Repeat Interval */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Repeat Interval (minutes)
          </Label>
          <Input
            type="number"
            min="1"
            max="1440"
            value={repeatInterval}
            onChange={(e) => setRepeatInterval(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Minutes between repeated notifications (1-1440)
          </p>
        </div>

        {/* Snooze Limit */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Snooze Limit
          </Label>
          <Input
            type="number"
            min="0"
            max="50"
            value={snoozeLimit}
            onChange={(e) => setSnoozeLimit(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">
            Number of snoozes before quick-snooze is disabled (0 = no snooze)
          </p>
        </div>
      </div>

      {/* Action Digest */}
      <div className="space-y-3 border-t border-border pt-5">
        <h3 className="text-xs font-semibold uppercase text-muted-foreground">
          Action Digest
        </h3>
        <p className="text-[11px] text-muted-foreground">
          Bundle pending actions into a single Telegram message sent at regular
          intervals during your active hours.
        </p>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={digestEnabled}
            onChange={(e) => setDigestEnabled(e.target.checked)}
            className="rounded border-border accent-[var(--accent)]"
          />
          <span className="text-sm text-foreground">Enable digest</span>
        </label>

        <div className="grid grid-cols-3 gap-4">
          {/* Interval */}
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Interval (hours)
            </Label>
            <Input
              type="number"
              min="1"
              max="12"
              value={digestIntervalHours}
              onChange={(e) => setDigestIntervalHours(e.target.value)}
              className="text-sm"
              disabled={!digestEnabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Send digest every N hours (1-12)
            </p>
          </div>

          {/* Start Hour */}
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Start Hour
            </Label>
            <Input
              type="number"
              min="0"
              max="23"
              value={digestStartHour}
              onChange={(e) => setDigestStartHour(e.target.value)}
              className="text-sm"
              disabled={!digestEnabled}
            />
            <p className="text-[11px] text-muted-foreground">
              First digest no earlier than (0-23)
            </p>
          </div>

          {/* End Hour */}
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              End Hour
            </Label>
            <Input
              type="number"
              min="0"
              max="23"
              value={digestEndHour}
              onChange={(e) => setDigestEndHour(e.target.value)}
              className="text-sm"
              disabled={!digestEnabled}
            />
            <p className="text-[11px] text-muted-foreground">
              Last digest no later than (0-23)
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
