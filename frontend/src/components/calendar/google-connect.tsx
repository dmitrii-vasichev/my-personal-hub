"use client";

import { useState } from "react";
import { Cloud, RefreshCw, Unlink, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useGoogleOAuthStatus, useSyncCalendar, useDisconnectGoogle } from "@/hooks/use-calendar";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function GoogleConnect() {
  const { data: status, isLoading } = useGoogleOAuthStatus();
  const syncCalendar = useSyncCalendar();
  const disconnectGoogle = useDisconnectGoogle();
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { auth_url } = await api.get<{ auth_url: string }>("/api/calendar/oauth/connect");
      window.location.href = auth_url;
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to connect Google Calendar");
      setIsConnecting(false);
    }
  };

  const handleSync = async () => {
    try {
      const result = await syncCalendar.mutateAsync();
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success(`Synced: ${result.pulled} pulled, ${result.pushed} pushed`);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Sync failed");
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect Google Calendar? Local events will remain.")) return;
    try {
      await disconnectGoogle.mutateAsync();
      toast.success("Google Calendar disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
  };

  if (isLoading) return null;

  if (!status?.connected) {
    return (
      <Button variant="outline" size="sm" onClick={handleConnect} disabled={isConnecting}>
        <Cloud size={14} className="mr-1" />
        {isConnecting ? "Connecting..." : "Connect Google"}
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="flex items-center gap-1.5 text-xs text-[--success]">
        <CheckCircle size={12} />
        Google Calendar
      </span>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleSync}
        disabled={syncCalendar.isPending}
        title="Sync now"
      >
        <RefreshCw size={14} className={syncCalendar.isPending ? "animate-spin" : ""} />
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={handleDisconnect}
        disabled={disconnectGoogle.isPending}
        title="Disconnect"
        className="text-[--text-tertiary] hover:text-[--danger]"
      >
        <Unlink size={14} />
      </Button>
    </div>
  );
}
