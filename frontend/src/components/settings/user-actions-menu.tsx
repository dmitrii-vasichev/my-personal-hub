"use client";

import { useState } from "react";
import { MoreHorizontal, ShieldCheck, ShieldOff, Lock, Trash2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useUpdateUser, useDeleteUser, useResetPassword } from "@/hooks/use-users";
import { useAuth } from "@/lib/auth";
import type { UserListItem } from "@/types/user";

interface UserActionsMenuProps {
  user: UserListItem;
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function ConfirmDialog({ title, message, confirmLabel, danger, onConfirm, onCancel }: ConfirmDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-[14px] border border-border bg-surface p-6 shadow-xl">
        <h3 className="mb-2 text-base font-semibold">{title}</h3>
        <p className="mb-5 text-sm text-muted-foreground">{message}</p>
        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:bg-surface-hover"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white ${
              danger ? "bg-danger hover:bg-danger/80" : "bg-accent hover:bg-accent/80"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

interface TempPasswordDialogProps {
  password: string;
  onClose: () => void;
}

function TempPasswordDialog({ password, onClose }: TempPasswordDialogProps) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(password);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-sm rounded-[14px] border border-border bg-surface p-6 shadow-xl">
        <h3 className="mb-2 text-base font-semibold">Temporary Password</h3>
        <p className="mb-4 text-sm text-muted-foreground">Share this with the user. They must change it on next login.</p>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
          <code className="flex-1 font-mono text-sm text-accent">{password}</code>
          <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground">
            {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <div className="mt-4 flex justify-end">
          <button onClick={onClose} className="rounded-md px-3 py-1.5 text-sm font-medium text-white bg-accent hover:bg-accent/80">
            Done
          </button>
        </div>
      </div>
    </div>
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

      {confirm === "role" && (
        <ConfirmDialog
          title="Change Role"
          message={`Change ${user.display_name}'s role to ${user.role === "admin" ? "member" : "admin"}?`}
          confirmLabel="Change Role"
          onConfirm={handleRoleToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "block" && (
        <ConfirmDialog
          title="Block User"
          message={`Block ${user.display_name}? They won't be able to log in.`}
          confirmLabel="Block"
          danger
          onConfirm={handleBlockToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "unblock" && (
        <ConfirmDialog
          title="Unblock User"
          message={`Unblock ${user.display_name}? They will be able to log in again.`}
          confirmLabel="Unblock"
          onConfirm={handleBlockToggle}
          onCancel={() => setConfirm(null)}
        />
      )}
      {confirm === "delete" && (
        <ConfirmDialog
          title="Delete User"
          message={`Delete ${user.display_name}? This action cannot be undone.`}
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setConfirm(null)}
        />
      )}
      {tempPassword && (
        <TempPasswordDialog
          password={tempPassword}
          onClose={() => setTempPassword(null)}
        />
      )}
    </div>
  );
}
