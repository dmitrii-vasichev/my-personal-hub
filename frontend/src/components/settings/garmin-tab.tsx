"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Watch, RefreshCw, Unplug, Loader2, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useVitalsConnection, useSyncVitals, VITALS_KEY } from "@/hooks/use-vitals";
import { api } from "@/lib/api";
import type { VitalsConnectionStatus } from "@/types/vitals";

const SYNC_INTERVALS = [
  { label: "1 hour", value: 60 },
  { label: "2 hours", value: 120 },
  { label: "4 hours", value: 240 },
  { label: "6 hours", value: 360 },
  { label: "12 hours", value: 720 },
  { label: "24 hours", value: 1440 },
] as const;

export function GarminSettingsTab() {
  const queryClient = useQueryClient();
  const { data: connection, isLoading } = useVitalsConnection();
  const syncVitals = useSyncVitals();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);

  const connectMutation = useMutation({
    mutationFn: (data: { email: string; password: string }) =>
      api.post<VitalsConnectionStatus>("/api/vitals/connect", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY, "connection"] });
      toast.success("Garmin connected successfully");
      setEmail("");
      setPassword("");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to connect Garmin");
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete("/api/vitals/disconnect"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY] });
      toast.success("Garmin disconnected");
      setShowDisconnect(false);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to disconnect Garmin");
    },
  });

  const intervalMutation = useMutation({
    mutationFn: (interval_minutes: number) =>
      api.patch<VitalsConnectionStatus>("/api/vitals/sync-interval", {
        interval_minutes,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [VITALS_KEY, "connection"] });
      toast.success("Sync interval updated");
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to update sync interval");
    },
  });

  const handleConnect = async () => {
    if (!email.trim() || !password.trim()) return;
    try {
      await connectMutation.mutateAsync({ email: email.trim(), password });
    } catch {
      // error handled by mutation
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnectMutation.mutateAsync();
    } catch {
      // error handled by mutation
    }
  };

  const handleIntervalChange = (value: string) => {
    const minutes = parseInt(value, 10);
    if (minutes > 0) {
      intervalMutation.mutate(minutes);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConnected = connection?.connected ?? false;

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
          Connect your Garmin account to sync health metrics — heart rate,
          sleep, steps, activities, and body battery data.
        </p>

        {/* Disconnected: email/password form */}
        {!isConnected && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-medium">
                Email
              </Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-medium">
                Password
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Garmin Connect password"
                  className="pr-9 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={
                !email.trim() || !password.trim() || connectMutation.isPending
              }
            >
              {connectMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Watch className="mr-1.5 h-3.5 w-3.5" />
              )}
              Connect Garmin
            </Button>
          </div>
        )}

        {/* Connected: status + controls */}
        {isConnected && connection && (
          <div className="space-y-4">
            {/* Status info */}
            <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                {connection.connected_at && (
                  <div>
                    <span className="text-muted-foreground">Connected: </span>
                    <span>
                      {new Date(connection.connected_at).toLocaleDateString()}
                    </span>
                  </div>
                )}
                {connection.last_sync_at && (
                  <div>
                    <span className="text-muted-foreground">Last sync: </span>
                    <span>
                      {new Date(connection.last_sync_at).toLocaleString()}
                    </span>
                  </div>
                )}
                {connection.sync_status && (
                  <div>
                    <span className="text-muted-foreground">Status: </span>
                    <span className="capitalize">
                      {connection.sync_status}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Sync now */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => syncVitals.mutate()}
                disabled={syncVitals.isPending}
              >
                <RefreshCw
                  className={`mr-1.5 h-3.5 w-3.5 ${
                    syncVitals.isPending ? "animate-spin" : ""
                  }`}
                />
                Sync now
              </Button>
            </div>

            {/* Sync interval */}
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground font-medium">
                Sync Interval
              </Label>
              <select
                value={connection.sync_interval_minutes ?? 360}
                onChange={(e) => handleIntervalChange(e.target.value)}
                disabled={intervalMutation.isPending}
                className="flex h-9 w-full max-w-xs rounded-md border border-border bg-surface px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                {SYNC_INTERVALS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    Every {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Disconnect */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              className="text-[var(--danger)] hover:text-[var(--danger)]"
            >
              <Unplug className="mr-1.5 h-3.5 w-3.5" />
              Disconnect
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={showDisconnect}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnect(false)}
        title="Disconnect Garmin"
        description="This will remove your Garmin connection and stop syncing health data. You can reconnect at any time."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnectMutation.isPending}
      />
    </div>
  );
}
