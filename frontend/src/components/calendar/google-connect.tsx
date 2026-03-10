"use client";

import { useState } from "react";
import { Cloud, RefreshCw, Unlink, CheckCircle, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Tooltip } from "@/components/ui/tooltip";
import { useGoogleOAuthStatus, useSyncCalendar, useDisconnectGoogle } from "@/hooks/use-calendar";
import { useAuth } from "@/lib/auth";
import { api } from "@/lib/api";
import { toast } from "sonner";

export function GoogleConnect() {
  const { data: status, isLoading } = useGoogleOAuthStatus();
  const syncCalendar = useSyncCalendar();
  const disconnectGoogle = useDisconnectGoogle();
  const { user } = useAuth();
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);

  const isAdmin = user?.role === "admin";

  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      const { auth_url } = await api.get<{ auth_url: string }>("/api/calendar/oauth/connect");
      window.location.href = auth_url;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "";
      // Check if it's a "not configured" error (503)
      if (message.includes("not configured")) {
        if (isAdmin) {
          toast.error("Google Calendar not configured", {
            description: "Set up OAuth credentials in Settings → Integrations.",
            action: {
              label: "Go to Settings",
              onClick: () => router.push("/settings"),
            },
          });
        } else {
          toast.error("Google Calendar is not configured. Contact your administrator.");
        }
      } else {
        toast.error(message || "Failed to connect Google Calendar");
      }
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

  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const handleDisconnect = async () => {
    try {
      await disconnectGoogle.mutateAsync();
      toast.success("Google Calendar disconnected");
    } catch {
      toast.error("Failed to disconnect");
    }
    setShowDisconnectConfirm(false);
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
      <Tooltip content="Sync now">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSync}
          disabled={syncCalendar.isPending}
        >
          <RefreshCw size={14} className={syncCalendar.isPending ? "animate-spin" : ""} />
        </Button>
      </Tooltip>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowDisconnectConfirm(true)}
        disabled={disconnectGoogle.isPending}
        className="text-[--text-tertiary] hover:text-[--danger]"
      >
        <Unlink size={14} />
      </Button>

      <ConfirmDialog
        open={showDisconnectConfirm}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnectConfirm(false)}
        title="Disconnect Google Calendar"
        description="Disconnect Google Calendar? Local events will remain."
        confirmLabel="Disconnect"
        loading={disconnectGoogle.isPending}
      />
    </div>
  );
}
