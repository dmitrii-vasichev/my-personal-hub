"use client";

import { useState } from "react";
import { Loader2, RefreshCw, Watch } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useVitalsConnection,
  useConnectGarmin,
  useDisconnectGarmin,
  useSyncVitals,
  useUpdateSyncInterval,
} from "@/hooks/use-vitals";

const INTERVAL_OPTIONS = [
  { value: 60, label: "1h" },
  { value: 120, label: "2h" },
  { value: 240, label: "4h" },
  { value: 360, label: "6h" },
  { value: 720, label: "12h" },
  { value: 1440, label: "24h" },
];

export function GarminSettingsTab() {
  const { data: connection, isLoading } = useVitalsConnection();
  const connectGarmin = useConnectGarmin();
  const disconnectGarmin = useDisconnectGarmin();
  const syncVitals = useSyncVitals();
  const updateInterval = useUpdateSyncInterval();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showDisconnect, setShowDisconnect] = useState(false);

  const isConnected = connection?.connected ?? false;

  const handleConnect = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await connectGarmin.mutateAsync({ email: email.trim(), password });
      setEmail("");
      setPassword("");
    } catch {
      // error handled by hook
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectGarmin.mutateAsync();
      setShowDisconnect(false);
    } catch {
      // error handled by hook
    }
  };

  const handleIntervalChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (minutes) {
      updateInterval.mutate(minutes);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12" data-testid="garmin-loading">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const lastSyncAgo = connection?.last_sync_at
    ? formatDistanceToNow(new Date(connection.last_sync_at), { addSuffix: true })
    : null;

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Watch className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Garmin Connection</h2>
          </div>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              isConnected
                ? "bg-success/10 text-success border border-success/20"
                : "bg-surface-2 text-muted-foreground border border-border"
            }`}
          >
            {isConnected ? "Connected" : "Not connected"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Connect your Garmin account to sync health metrics, sleep data, and
          activities for AI-powered daily briefings.
        </p>

        {/* Disconnected state: connect form */}
        {!isConnected && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@garmin.com"
                className="text-sm"
                data-testid="garmin-email"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Password
              </Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Garmin Connect password"
                className="text-sm"
                data-testid="garmin-password"
              />
            </div>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={!email.trim() || !password.trim() || connectGarmin.isPending}
              data-testid="garmin-connect-btn"
            >
              {connectGarmin.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Connect
            </Button>
          </div>
        )}

        {/* Connected state: status + actions */}
        {isConnected && connection && (
          <div className="space-y-4">
            {/* Status info */}
            <div className="flex flex-wrap items-center gap-4 text-sm">
              {lastSyncAgo && (
                <div>
                  <span className="text-muted-foreground">Last sync: </span>
                  <span>{lastSyncAgo}</span>
                </div>
              )}
              {connection.sync_status && (
                <div>
                  <span className="text-muted-foreground">Status: </span>
                  <span>{connection.sync_status}</span>
                </div>
              )}
              {connection.sync_error && (
                <div className="text-destructive text-xs">
                  Error: {connection.sync_error}
                </div>
              )}
            </div>

            {/* Sync interval */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Sync Interval
              </Label>
              <Select
                value={String(connection.sync_interval_minutes ?? 240)}
                onChange={(e) =>
                  handleIntervalChange((e.target as HTMLSelectElement).value)
                }
                className="text-sm"
                data-testid="garmin-interval"
              >
                {INTERVAL_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Every {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncVitals.mutate()}
                disabled={syncVitals.isPending}
                data-testid="garmin-sync-btn"
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${syncVitals.isPending ? "animate-spin" : ""}`}
                />
                {syncVitals.isPending ? "Syncing..." : "Sync now"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDisconnect(true)}
                className="text-[var(--danger)] hover:text-[var(--danger)]"
                data-testid="garmin-disconnect-btn"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={showDisconnect}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnect(false)}
        title="Disconnect Garmin"
        description="This will disconnect your Garmin account. Historical health data will be preserved."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectGarmin.isPending}
      />
    </div>
  );
}
