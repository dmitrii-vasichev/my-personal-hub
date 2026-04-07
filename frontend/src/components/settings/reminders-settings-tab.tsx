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

  // Sync form state when server settings arrive
  const [prevSettings, setPrevSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings);
    setRepeatCount(String(settings.reminder_repeat_count ?? 5));
    setRepeatInterval(String(settings.reminder_repeat_interval ?? 5));
    setSnoozeLimit(String(settings.reminder_snooze_limit ?? 5));
  }

  const handleSave = async () => {
    try {
      await updateSettings.mutateAsync({
        reminder_repeat_count: parseInt(repeatCount) || 5,
        reminder_repeat_interval: parseInt(repeatInterval) || 5,
        reminder_snooze_limit: parseInt(snoozeLimit) || 5,
      });
    } catch {
      // Error handled by hook
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
        Loading reminder settings...
      </div>
    );
  }

  return (
    <section className="space-y-6 rounded-lg border border-border p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">
          Reminder Defaults
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
        These settings control how reminders nag you and how many times you can
        snooze before quick-snooze is disabled.
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
    </section>
  );
}
