"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldCheck, ShieldOff, Lock, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useUpdateUser, useDeleteUser, useResetPassword } from "@/hooks/use-users";
import { useAuth } from "@/lib/auth";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { UserListItem } from "@/types/user";

interface UserActionsMenuProps {
  user: UserListItem;
}

function TempPasswordDialog({ password, onClose }: { password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Dialog open onOpenChange={(val) => !val && onClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-sm p-6">
          <DialogTitle>Temporary Password</DialogTitle>
          <DialogDescription className="mt-2">
            Share this with the user. They must change it on next login.
          </DialogDescription>
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <code className="flex-1 font-mono text-sm text-accent">{password}</code>
            <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <div className="mt-4 flex justify-end">
            <Button size="sm" onClick={onClose}>
              Done
            </Button>
          </div>
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}

export function UserActionsMenu({ user }: UserActionsMenuProps) {
  const { user: currentUser } = useAuth();
  const updateUser = useUpdateUser();
  const deleteUser = useDeleteUser();
  const resetPassword = useResetPassword();

  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState<null | "block" | "unblock" | "delete" | "role">(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  const isSelf = currentUser?.id === user.id;

  const handleRoleToggle = async () => {
    const newRole = user.role === "admin" ? "member" : "admin";
    try {
      await updateUser.mutateAsync({ id: user.id, data: { role: newRole } });
      toast.success(`Role changed to ${newRole}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update role");
    }
    setConfirm(null);
  };

  const handleBlockToggle = async () => {
    const blocking = !user.is_blocked;
    try {
      await updateUser.mutateAsync({ id: user.id, data: { is_blocked: blocking } });
      toast.success(blocking ? "User blocked" : "User unblocked");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update user");
    }
    setConfirm(null);
  };

  const handleResetPassword = async () => {
    try {
      const result = await resetPassword.mutateAsync(user.id);
      setTempPassword(result.temporary_password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to reset password");
    }
  };

  const handleDelete = async () => {
    try {
      await deleteUser.mutateAsync(user.id);
      toast.success("User deleted");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete user");
    }
    setConfirm(null);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded p-1 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-border bg-surface-2 py-1 shadow-lg">
            <button
              onClick={() => { setOpen(false); setConfirm("role"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              {user.role === "admin" ? <ShieldOff className="h-3.5 w-3.5" /> : <ShieldCheck className="h-3.5 w-3.5" />}
              {user.role === "admin" ? "Make Member" : "Make Admin"}
            </button>
            <button
              onClick={() => { setOpen(false); setConfirm(user.is_blocked ? "unblock" : "block"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              <Lock className="h-3.5 w-3.5" />
              {user.is_blocked ? "Unblock" : "Block"}
            </button>
            <button
              onClick={() => { setOpen(false); handleResetPassword(); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              <Lock className="h-3.5 w-3.5" />
              Reset Password
            </button>
            {!isSelf && (
              <button
                onClick={() => { setOpen(false); setConfirm("delete"); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-surface-hover"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete
              </button>
            )}
          </div>
        </>
      )}

      <ConfirmDialog
        open={confirm === "role"}
        onConfirm={handleRoleToggle}
        onCancel={() => setConfirm(null)}
        title="Change Role"
        description={`Change ${user.display_name}'s role to ${user.role === "admin" ? "member" : "admin"}?`}
        confirmLabel="Change Role"
      />
      <ConfirmDialog
        open={confirm === "block"}
        onConfirm={handleBlockToggle}
        onCancel={() => setConfirm(null)}
        title="Block User"
        description={`Block ${user.display_name}? They won't be able to log in.`}
        confirmLabel="Block"
        variant="danger"
      />
      <ConfirmDialog
        open={confirm === "unblock"}
        onConfirm={handleBlockToggle}
        onCancel={() => setConfirm(null)}
        title="Unblock User"
        description={`Unblock ${user.display_name}? They will be able to log in again.`}
        confirmLabel="Unblock"
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onConfirm={handleDelete}
        onCancel={() => setConfirm(null)}
        title="Delete User"
        description={`Delete ${user.display_name}? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
      {tempPassword && (
        <TempPasswordDialog
          password={tempPassword}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}
