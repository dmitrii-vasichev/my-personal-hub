"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, Check, Plus, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  useApiTokens,
  useCreateApiToken,
  useRevokeApiToken,
} from "@/hooks/use-api-tokens";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { ApiTokenListItem } from "@/types/api-token";

// ── Relative time helper ────────────────────────────────────────────────────

function formatRelative(iso: string | null): string {
  if (!iso) return "Never";
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true });
  } catch {
    return iso;
  }
}

// ── Token row with inline revoke confirm ────────────────────────────────────

function TokenRow({
  token,
  canRevoke,
}: {
  token: ApiTokenListItem;
  canRevoke: boolean;
}) {
  const revoke = useRevokeApiToken();
  const [confirmRevoke, setConfirmRevoke] = useState(false);

  const handleRevoke = async () => {
    if (!confirmRevoke) {
      setConfirmRevoke(true);
      return;
    }
    try {
      await revoke.mutateAsync(token.id);
      toast.success(`Token "${token.name}" revoked`);
      setConfirmRevoke(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to revoke token");
      setConfirmRevoke(false);
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-4 py-3">
      <KeyRound className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {token.name}
          </span>
          <code className="font-mono text-xs text-muted-foreground">
            {token.token_prefix}…
          </code>
        </div>
        <div className="mt-0.5 flex gap-3 text-[11px] text-muted-foreground">
          <span>Created {formatRelative(token.created_at)}</span>
          <span>·</span>
          <span>Last used {formatRelative(token.last_used_at)}</span>
        </div>
      </div>

      {canRevoke && (
        <div className="flex items-center gap-2">
          {confirmRevoke && !revoke.isPending && (
            <button
              type="button"
              onClick={() => setConfirmRevoke(false)}
              aria-label={`Cancel revoking ${token.name}`}
              className="text-xs text-muted-foreground hover:text-foreground cursor-pointer"
            >
              Cancel
            </button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleRevoke}
            disabled={revoke.isPending}
            aria-label={`Revoke token ${token.name}`}
            className={
              confirmRevoke ? "border-destructive text-destructive hover:bg-destructive/10" : ""
            }
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            {revoke.isPending
              ? "Revoking…"
              : confirmRevoke
                ? "Click again to confirm"
                : "Revoke"}
          </Button>
        </div>
      )}
    </div>
  );
}

// ── Create token dialog ─────────────────────────────────────────────────────

function CreateTokenDialog({
  open,
  onClose,
  finalFocusRef,
}: {
  open: boolean;
  onClose: () => void;
  finalFocusRef: React.RefObject<HTMLButtonElement | null>;
}) {
  const createToken = useCreateApiToken();
  const [name, setName] = useState("");
  const [rawToken, setRawToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const rawTokenInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus + select-all when dialog transitions to the "shown once" view
  useEffect(() => {
    if (rawToken && rawTokenInputRef.current) {
      rawTokenInputRef.current.focus();
      rawTokenInputRef.current.select();
    }
  }, [rawToken]);

  const reset = () => {
    setName("");
    setRawToken(null);
    setCopied(false);
  };

  const handleClose = () => {
    // Clear raw token from component state — never persisted
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("Name is required");
      return;
    }
    try {
      const result = await createToken.mutateAsync({ name: trimmed });
      setRawToken(result.raw_token);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create token");
    }
  };

  const handleCopy = async () => {
    if (!rawToken) return;
    try {
      await navigator.clipboard.writeText(rawToken);
      setCopied(true);
      toast.success("Token copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: select the input so the user can Cmd/Ctrl+C
      rawTokenInputRef.current?.focus();
      rawTokenInputRef.current?.select();
      toast.error("Failed to copy — please copy manually");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6" finalFocus={finalFocusRef}>
          {rawToken ? (
            <>
              <DialogTitle>Your token (shown once)</DialogTitle>
              <DialogDescription className="mt-2">
                Copy this token now. For security, we won&apos;t show it again
                — you&apos;ll need to create a new one if you lose it.
              </DialogDescription>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <input
                  ref={rawTokenInputRef}
                  type="text"
                  value={rawToken}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                  aria-label="Generated API token"
                  className="flex-1 min-w-0 bg-transparent font-mono text-xs text-accent focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="shrink-0 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title="Copy to clipboard"
                  aria-label="Copy token to clipboard"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Treat this token like a password. Anyone with it can access your
                account via the API.
              </p>
              <div className="mt-6 flex justify-end">
                <Button size="sm" onClick={handleClose}>
                  Done
                </Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Create API token</DialogTitle>
              <DialogDescription className="mt-2">
                Give your token a memorable name so you can identify it later.
              </DialogDescription>
              <div className="mt-4 space-y-1">
                <Label className="text-xs uppercase text-muted-foreground">
                  Name
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && name.trim()) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="e.g. laptop CLI, planner skill"
                  maxLength={100}
                  className="text-sm"
                  autoFocus
                />
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={!name.trim() || createToken.isPending}
                >
                  {createToken.isPending ? "Creating…" : "Create token"}
                </Button>
              </div>
            </>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function ApiTokensTab() {
  const { isDemo } = useAuth();
  const { data: tokens = [], isLoading, isError } = useApiTokens();
  const [creating, setCreating] = useState(false);
  const createButtonRef = useRef<HTMLButtonElement>(null);

  if (isLoading) {
    return (
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
          Loading tokens…
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="space-y-4 rounded-lg border border-border p-5">
        <div className="flex h-32 items-center justify-center text-sm text-destructive">
          Failed to load API tokens — check backend connection
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-lg border border-border p-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-sm font-semibold text-foreground">API Tokens</h2>
          <p className="text-xs text-muted-foreground">
            Long-lived tokens for scripts and integrations. Treat them like
            passwords.
          </p>
        </div>
        {!isDemo && (
          <Button
            ref={createButtonRef}
            variant="outline"
            size="sm"
            onClick={() => setCreating(true)}
          >
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create token
          </Button>
        )}
      </div>

      {/* Demo notice */}
      {isDemo && (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          API tokens can&apos;t be created or revoked in demo mode.
        </div>
      )}

      {/* Token list */}
      {tokens.length === 0 ? (
        <div className="flex h-24 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted-foreground">
          No tokens yet. Create one to get started.
        </div>
      ) : (
        <div className="space-y-2">
          {tokens.map((token) => (
            <TokenRow key={token.id} token={token} canRevoke={!isDemo} />
          ))}
        </div>
      )}

      {/* Create dialog */}
      <CreateTokenDialog
        open={creating}
        onClose={() => setCreating(false)}
        finalFocusRef={createButtonRef}
      />
    </section>
  );
}
