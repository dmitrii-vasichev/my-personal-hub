"use client";

import { useState } from "react";
import { MessageCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useTelegramConfig,
  useTelegramStatus,
  useTelegramStartAuth,
  useTelegramVerifyCode,
  useTelegramDisconnect,
} from "@/hooks/use-telegram";

type AuthStep = "disconnected" | "awaiting_code" | "connected";

export function TelegramTab() {
  const { data: config, isLoading: configLoading } = useTelegramConfig();
  const { data: status, isLoading } = useTelegramStatus();
  const startAuth = useTelegramStartAuth();
  const verifyCode = useTelegramVerifyCode();
  const disconnect = useTelegramDisconnect();

  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [step, setStep] = useState<AuthStep>("disconnected");

  // Determine current step from status
  const currentStep: AuthStep = step === "awaiting_code"
    ? "awaiting_code"
    : status?.connected
      ? "connected"
      : "disconnected";

  const handleStartAuth = async () => {
    try {
      await startAuth.mutateAsync({ phone_number: phone });
      setStep("awaiting_code");
    } catch {
      // error handled by hook
    }
  };

  const handleVerifyCode = async () => {
    try {
      await verifyCode.mutateAsync({
        code,
        ...(show2FA && password ? { password } : {}),
      });
      setStep("disconnected"); // reset step, status query will show connected
      setPhone("");
      setCode("");
      setPassword("");
      setShow2FA(false);
    } catch {
      // error handled by hook
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect.mutateAsync();
      setShowDisconnect(false);
      setStep("disconnected");
    } catch {
      // error handled by hook
    }
  };

  const notConfigured = config && !config.configured;

  if (isLoading || configLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Telegram Connection</h2>
          </div>
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              currentStep === "connected"
                ? "bg-success/10 text-success border border-success/20"
                : currentStep === "awaiting_code"
                  ? "bg-warning/10 text-warning border border-warning/20"
                  : "bg-surface-2 text-muted-foreground border border-border"
            }`}
          >
            {currentStep === "connected"
              ? "✓ Connected"
              : currentStep === "awaiting_code"
                ? "Awaiting code"
                : "Not connected"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          Connect your Telegram account to enable Pulse — automatic message
          collection, filtering, and AI-powered digests from your channels and
          groups.
        </p>

        {/* Not configured warning */}
        {notConfigured && currentStep === "disconnected" && (
          <div className="rounded-md border border-warning/30 bg-warning/5 px-3 py-2.5">
            <p className="text-xs text-warning">
              Telegram API credentials are not configured. Set{" "}
              <code className="font-mono text-[11px]">TELEGRAM_API_ID</code> and{" "}
              <code className="font-mono text-[11px]">TELEGRAM_API_HASH</code> in
              your <code className="font-mono text-[11px]">.env</code> file.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Get credentials at{" "}
              <a
                href="https://my.telegram.org/apps"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                my.telegram.org/apps
              </a>
            </p>
          </div>
        )}

        {/* Disconnected: phone input */}
        {currentStep === "disconnected" && !notConfigured && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Phone Number
              </Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 900 123 4567"
                className="text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">
                International format with country code.
              </p>
            </div>
            <Button
              size="sm"
              onClick={handleStartAuth}
              disabled={!phone.trim() || startAuth.isPending}
            >
              {startAuth.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : null}
              Connect
            </Button>
          </div>
        )}

        {/* Awaiting code: code input + optional 2FA */}
        {currentStep === "awaiting_code" && (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs uppercase text-muted-foreground">
                Verification Code
              </Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="12345"
                className="text-sm font-mono"
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Enter the code sent to your Telegram app.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="show-2fa"
                checked={show2FA}
                onChange={(e) => setShow2FA(e.target.checked)}
                className="cursor-pointer"
              />
              <label
                htmlFor="show-2fa"
                className="text-xs text-muted-foreground cursor-pointer"
              >
                I have two-factor authentication enabled
              </label>
            </div>

            {show2FA && (
              <div className="space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">
                  2FA Password
                </Label>
                <Input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Your 2FA password"
                  className="text-sm"
                />
              </div>
            )}

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleVerifyCode}
                disabled={!code.trim() || verifyCode.isPending}
              >
                {verifyCode.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Verify
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("disconnected");
                  setCode("");
                  setPassword("");
                  setShow2FA(false);
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Connected: status + disconnect */}
        {currentStep === "connected" && status && (
          <div className="space-y-3">
            <div className="flex items-center gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Phone: </span>
                <span className="font-mono">{status.phone_number}</span>
              </div>
              {status.connected_at && (
                <div>
                  <span className="text-muted-foreground">Connected: </span>
                  <span>
                    {new Date(status.connected_at).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowDisconnect(true)}
              className="text-[var(--danger)] hover:text-[var(--danger)]"
            >
              Disconnect
            </Button>
          </div>
        )}
      </section>

      <ConfirmDialog
        open={showDisconnect}
        onConfirm={handleDisconnect}
        onCancel={() => setShowDisconnect(false)}
        title="Disconnect Telegram"
        description="This will revoke your Telegram session. You'll need to reconnect to use Pulse features."
        confirmLabel="Disconnect"
        variant="danger"
        loading={disconnect.isPending}
      />
    </div>
  );
}
