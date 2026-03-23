"use client";

import { useState } from "react";
import { RefreshCw, Save, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  usePulseSettings,
  useUpdatePulseSettings,
  useTriggerPoll,
  useTestBotConnection,
} from "@/hooks/use-pulse-settings";
import { usePollStatus } from "@/hooks/use-pulse-sources";

export function PulseSettingsTab() {
  const { data: settings, isLoading } = usePulseSettings();
  const updateSettings = useUpdatePulseSettings();
  const pollStatus = usePollStatus();
  const triggerPoll = useTriggerPoll(pollStatus.startPolling);
  const testBot = useTestBotConnection();

  const [pollingInterval, setPollingInterval] = useState("60");
  const [pollMessageLimit, setPollMessageLimit] = useState("100");
  const [ttlDays, setTtlDays] = useState("30");
  const [digestSchedule, setDigestSchedule] = useState("daily");
  const [digestTime, setDigestTime] = useState("09:00");
  const [digestDay, setDigestDay] = useState("1");
  const [digestIntervalDays, setDigestIntervalDays] = useState("2");
  const [timezone, setTimezone] = useState("America/Denver");
  const [notifyDigest, setNotifyDigest] = useState(true);
  const [notifyJobs, setNotifyJobs] = useState(true);
  const [botToken, setBotToken] = useState("");
  const [botChatId, setBotChatId] = useState("");
  const [botTokenSet, setBotTokenSet] = useState(false);

  // Sync form state when server settings change (render-time adjustment)
  const [prevSettings, setPrevSettings] = useState<typeof settings>(undefined);
  if (settings && settings !== prevSettings) {
    setPrevSettings(settings);
    setPollingInterval(String(settings.polling_interval_minutes));
    setPollMessageLimit(String(settings.poll_message_limit));
    setTtlDays(String(settings.message_ttl_days));
    setDigestSchedule(settings.digest_schedule);
    setDigestTime(settings.digest_time?.slice(0, 5) || "09:00");
    setTimezone(settings.timezone || "America/Denver");
    setDigestDay(String(settings.digest_day ?? 1));
    setDigestIntervalDays(String(settings.digest_interval_days ?? 2));
    setNotifyDigest(settings.notify_digest_ready);
    setNotifyJobs(settings.notify_urgent_jobs);
    setBotTokenSet(settings.bot_token_set);
    setBotChatId(settings.bot_chat_id ? String(settings.bot_chat_id) : "");
  }

  const handleSave = async () => {
    try {
      const data: Record<string, unknown> = {
        polling_interval_minutes: parseInt(pollingInterval) || 60,
        poll_message_limit: parseInt(pollMessageLimit) || 100,
        message_ttl_days: parseInt(ttlDays) || 30,
        digest_schedule: digestSchedule,
        digest_time: digestTime + ":00",
        timezone,
        digest_day: digestSchedule === "weekly" ? parseInt(digestDay) : undefined,
        digest_interval_days:
          digestSchedule === "every_n_days" ? parseInt(digestIntervalDays) : undefined,
        notify_digest_ready: notifyDigest,
        notify_urgent_jobs: notifyJobs,
      };
      if (botToken) {
        data.bot_token = botToken;
      }
      if (botChatId) {
        data.bot_chat_id = parseInt(botChatId);
      }
      await updateSettings.mutateAsync(data);
      if (botToken) {
        setBotToken("");
        setBotTokenSet(true);
      }
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

  const canTestBot = (botTokenSet || botToken) && botChatId;

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

        {/* Poll Message Limit */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Messages per Poll
          </Label>
          <Input
            type="number"
            min="10"
            max="500"
            value={pollMessageLimit}
            onChange={(e) => setPollMessageLimit(e.target.value)}
            className="text-sm"
          />
          <p className="text-[11px] text-muted-foreground">Max messages fetched per source (10–500)</p>
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
            <option value="every_n_days">Every N days</option>
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

        {/* Timezone */}
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">
            Timezone
          </Label>
          <Select
            value={timezone}
            onChange={(e) => setTimezone((e.target as HTMLSelectElement).value)}
            className="text-sm"
          >
            <option value="America/Denver">America/Denver (MT)</option>
            <option value="America/New_York">America/New_York (ET)</option>
            <option value="America/Chicago">America/Chicago (CT)</option>
            <option value="America/Los_Angeles">America/Los_Angeles (PT)</option>
            <option value="Europe/Moscow">Europe/Moscow (MSK)</option>
            <option value="Europe/London">Europe/London (GMT)</option>
            <option value="Europe/Berlin">Europe/Berlin (CET)</option>
            <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
            <option value="UTC">UTC</option>
          </Select>
          <p className="text-[11px] text-muted-foreground">Digest time is in this timezone</p>
        </div>

        {/* Weekly Day Selector */}
        {digestSchedule === "weekly" && (
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Day of Week
            </Label>
            <Select
              value={digestDay}
              onChange={(e) => setDigestDay((e.target as HTMLSelectElement).value)}
              className="text-sm"
            >
              <option value="0">Monday</option>
              <option value="1">Tuesday</option>
              <option value="2">Wednesday</option>
              <option value="3">Thursday</option>
              <option value="4">Friday</option>
              <option value="5">Saturday</option>
              <option value="6">Sunday</option>
            </Select>
          </div>
        )}

        {/* Interval Days */}
        {digestSchedule === "every_n_days" && (
          <div className="space-y-1">
            <Label className="text-xs uppercase text-muted-foreground">
              Every N Days
            </Label>
            <Input
              type="number"
              min="2"
              max="30"
              value={digestIntervalDays}
              onChange={(e) => setDigestIntervalDays(e.target.value)}
              className="text-sm"
            />
          </div>
        )}
      </div>

      {/* Telegram Bot Notifications */}
      <div className="space-y-3">
        <Label className="text-xs uppercase text-muted-foreground">
          Telegram Bot Notifications
        </Label>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Bot Token</Label>
            <Input
              type="password"
              placeholder="Paste token from @BotFather"
              value={botToken}
              onChange={(e) => setBotToken(e.target.value)}
              className="text-sm"
            />
            {botTokenSet && !botToken && (
              <p className="text-[11px] text-green-600">Token configured</p>
            )}
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Chat ID</Label>
            <Input
              type="number"
              placeholder="Your Telegram chat ID"
              value={botChatId}
              onChange={(e) => setBotChatId(e.target.value)}
              className="text-sm"
            />
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground">
          Create a bot via @BotFather, paste the token. Send /start to the bot, then use @userinfobot to get your chat ID.
        </p>

        {canTestBot && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => testBot.mutate()}
            disabled={testBot.isPending}
          >
            <Send className="mr-1.5 h-3.5 w-3.5" />
            {testBot.isPending ? "Testing..." : "Test Connection"}
          </Button>
        )}
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
