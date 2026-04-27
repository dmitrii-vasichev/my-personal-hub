"use client";

import { useState } from "react";
import { MessageCircle, Loader2, Bot } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  useTelegramConfig,
  useTelegramSaveCredentials,
  useTelegramStatus,
  useTelegramStartAuth,
  useTelegramVerifyCode,
  useTelegramDisconnect,
} from "@/hooks/use-telegram";
import {
  useSetTelegramPin,
  useSetTelegramUserId,
} from "@/hooks/use-telegram-bridge";
import { useAuth } from "@/lib/auth";

type AuthStep = "disconnected" | "awaiting_code" | "connected";

const PIN_PATTERN = /^\d{4,8}$/;
const USER_ID_PATTERN = /^\d+$/;

export function TelegramTab() {
  const { data: config, isLoading: configLoading } = useTelegramConfig();
  const { data: status, isLoading } = useTelegramStatus();
  const saveCredentials = useTelegramSaveCredentials();
  const startAuth = useTelegramStartAuth();
  const verifyCode = useTelegramVerifyCode();
  const disconnect = useTelegramDisconnect();

  // Telegram Bridge (Phase 2) — owner-only self-service for the
  // Telegram→Claude-Code bot. Auth comes from the in-memory
  // AuthContext user (populated by /api/auth/me), not React Query, so
  // we call refreshUser() after a successful mutation to refresh the
  // status badge.
  const { user, refreshUser, isLoading: authLoading } = useAuth();
  const setTelegramUserIdMutation = useSetTelegramUserId();
  const setTelegramPinMutation = useSetTelegramPin();

  const [apiId, setApiId] = useState("");
  const [apiHash, setApiHash] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [show2FA, setShow2FA] = useState(false);
  const [showDisconnect, setShowDisconnect] = useState(false);
  const [step, setStep] = useState<AuthStep>("disconnected");

  const [bridgeTgUserId, setBridgeTgUserId] = useState("");
  const [bridgePin, setBridgePin] = useState("");

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

  const handleSaveCredentials = async () => {
    const id = parseInt(apiId, 10);
    if (!id || id <= 0 || !apiHash.trim()) return;
    try {
      await saveCredentials.mutateAsync({ api_id: id, api_hash: apiHash.trim() });
      setApiId("");
      setApiHash("");
    } catch {
      // error handled by hook
    }
  };

  // --- Telegram Bridge handlers ---------------------------------------------

  const bridgeConfigured = Boolean(
    user?.telegram_user_id && user?.telegram_pin_configured,
  );
  const bridgePartiallyConfigured =
    !authLoading &&
    user !== null &&
    !bridgeConfigured;
  const bridgePinValid = PIN_PATTERN.test(bridgePin);
  const bridgeUserIdValid = USER_ID_PATTERN.test(bridgeTgUserId.trim());

  const handleSaveBridgeUserId = async () => {
    if (!bridgeUserIdValid) {
      toast.error("User ID must be digits only");
      return;
    }
    const id = parseInt(bridgeTgUserId.trim(), 10);
    if (!id || id <= 0) return;
    try {
      await setTelegramUserIdMutation.mutateAsync({ telegram_user_id: id });
      await refreshUser();
      setBridgeTgUserId("");
      toast.success("Telegram user id saved");
    } catch {
      // error surfaced via the hook's onError toast
    }
  };

  const handleSaveBridgePin = async () => {
    if (!bridgePinValid) return;
    try {
      await setTelegramPinMutation.mutateAsync({ pin: bridgePin });
      await refreshUser();
      setBridgePin("");
      toast.success("PIN saved");
    } catch {
      // error surfaced via the hook's onError toast
    }
  };

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
            <h2 className="text-sm font-medium">Telegram Pulse</h2>
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

        {/* API Credentials section */}
        {currentStep === "disconnected" && (
          <div className="space-y-3">
            {config?.configured && config.api_id ? (
              <div className="rounded-md border border-border bg-surface-2/50 px-3 py-2.5">
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">API ID: </span>
                    <span className="font-mono">{config.api_id}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">API Hash: </span>
                    <span className="font-mono">{"••••••••"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-md border border-warning/30 bg-warning/5 px-3 py-3">
                <p className="text-xs text-warning">
                  Telegram API credentials required.{" "}
                  <a
                    href="https://my.telegram.org/apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Get them at my.telegram.org/apps
                  </a>
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                      API ID
                    </Label>
                    <Input
                      type="number"
                      value={apiId}
                      onChange={(e) => setApiId(e.target.value)}
                      placeholder="12345678"
                      className="text-sm font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs uppercase text-muted-foreground">
                      API Hash
                    </Label>
                    <Input
                      type="password"
                      value={apiHash}
                      onChange={(e) => setApiHash(e.target.value)}
                      placeholder="32-character hex string"
                      className="text-sm font-mono"
                    />
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={handleSaveCredentials}
                  disabled={
                    !apiId.trim() ||
                    !apiHash.trim() ||
                    saveCredentials.isPending
                  }
                >
                  {saveCredentials.isPending ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Save Credentials
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Disconnected: phone input (only when credentials are configured) */}
        {currentStep === "disconnected" && config?.configured && (
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

      {/* Telegram Bridge — owner-only self-service for the Telegram→CC bot */}
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-medium">Telegram Bridge</h2>
          </div>
          <span
            role="status"
            aria-live="polite"
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${
              authLoading || user === null
                ? "bg-surface-2 text-muted-foreground border border-border"
                : bridgeConfigured
                  ? "bg-success/10 text-success border border-success/20"
                  : "bg-warning/10 text-warning border border-warning/20"
            }`}
          >
            {authLoading || user === null
              ? "Unknown"
              : bridgeConfigured
                ? "✓ Configured"
                : "⚠ Not configured"}
          </span>
        </div>

        <p className="text-xs text-muted-foreground">
          PIN is used by the Telegram bridge bot to unlock destructive
          operations. 10-minute window per <code>/unlock</code>.
        </p>

        {bridgePartiallyConfigured && (
          <p className="text-xs text-warning">
            {!user?.telegram_user_id && !user?.telegram_pin_configured
              ? "Set your Telegram user id and PIN below."
              : !user?.telegram_user_id
                ? "Telegram user id is missing."
                : "PIN is not set."}
          </p>
        )}

        <div className="space-y-3">
          <div className="space-y-1">
            <Label
              htmlFor="bridge-user-id"
              className="text-xs uppercase text-muted-foreground"
            >
              Telegram User ID
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="bridge-user-id"
                type="number"
                value={bridgeTgUserId}
                onChange={(e) => setBridgeTgUserId(e.target.value)}
                placeholder={
                  user?.telegram_user_id
                    ? String(user.telegram_user_id)
                    : "123456789"
                }
                className="text-sm font-mono"
                aria-describedby="bridge-user-id-error"
                aria-invalid={
                  bridgeTgUserId.length > 0 && !bridgeUserIdValid
                }
              />
              <Button
                size="sm"
                onClick={handleSaveBridgeUserId}
                disabled={
                  !bridgeUserIdValid || setTelegramUserIdMutation.isPending
                }
              >
                {setTelegramUserIdMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                Save
              </Button>
            </div>
            {bridgeTgUserId.length > 0 && !bridgeUserIdValid ? (
              <p
                id="bridge-user-id-error"
                className="text-xs text-[var(--danger)]"
              >
                Must be digits only.
              </p>
            ) : user?.telegram_user_id ? (
              <p
                id="bridge-user-id-error"
                className="text-xs text-muted-foreground"
              >
                Currently bound to <span className="font-mono">{user.telegram_user_id}</span>.
              </p>
            ) : (
              <p
                id="bridge-user-id-error"
                className="text-xs text-muted-foreground"
              >
                Your numeric Telegram account id (e.g. from @userinfobot).
              </p>
            )}
          </div>

          <div className="space-y-1">
            <Label
              htmlFor="bridge-pin"
              className="text-xs uppercase text-muted-foreground"
            >
              PIN
            </Label>
            <div className="flex items-center gap-2">
              <Input
                id="bridge-pin"
                type="password"
                value={bridgePin}
                onChange={(e) => setBridgePin(e.target.value)}
                placeholder="4–8 digits"
                className="text-sm font-mono"
                inputMode="numeric"
                autoComplete="new-password"
                aria-describedby="bridge-pin-error"
                aria-invalid={bridgePin.length > 0 && !bridgePinValid}
              />
              <Button
                size="sm"
                onClick={handleSaveBridgePin}
                disabled={
                  !bridgePinValid || setTelegramPinMutation.isPending
                }
              >
                {setTelegramPinMutation.isPending ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : null}
                {user?.telegram_pin_configured ? "Rotate PIN" : "Set PIN"}
              </Button>
            </div>
            {bridgePin.length > 0 && !bridgePinValid ? (
              <p
                id="bridge-pin-error"
                className="text-xs text-[var(--danger)]"
              >
                Must be 4–8 digits.
              </p>
            ) : (
              <p
                id="bridge-pin-error"
                className="text-xs text-muted-foreground"
              >
                Stored bcrypt-hashed. The raw PIN is never persisted.
              </p>
            )}
          </div>
        </div>
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
