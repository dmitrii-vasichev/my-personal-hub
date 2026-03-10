"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Copy, Check } from "lucide-react";
import { useCreateUser } from "@/hooks/use-users";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogPopup,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface CreateUserDialogProps {
  open: boolean;
  onClose: () => void;
}

export function CreateUserDialog({ open, onClose }: CreateUserDialogProps) {
  const createUser = useCreateUser();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<"admin" | "member">("member");
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const reset = () => {
    setEmail("");
    setDisplayName("");
    setRole("member");
    setTempPassword(null);
    setCopied(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!email.trim() || !displayName.trim()) {
      toast.error("Email and display name are required");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast.error("Invalid email format");
      return;
    }
    try {
      const result = await createUser.mutateAsync({ email, display_name: displayName, role });
      setTempPassword(result.temporary_password);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create user");
    }
  };

  const handleCopy = async () => {
    if (!tempPassword) return;
    await navigator.clipboard.writeText(tempPassword);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleClose()}>
      <DialogPortal>
        <DialogBackdrop />
        <DialogPopup className="w-full max-w-md p-6">
          {tempPassword ? (
            <>
              <DialogTitle>User Created</DialogTitle>
              <DialogDescription className="mt-2">
                Share this temporary password with the user. They will be required to change it on first login.
              </DialogDescription>
              <div className="mt-4 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
                <code className="flex-1 font-mono text-sm text-accent">{tempPassword}</code>
                <button
                  onClick={handleCopy}
                  className="text-muted-foreground hover:text-foreground transition-colors"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
              <div className="mt-4 flex justify-end">
                <Button size="sm" onClick={handleClose}>Done</Button>
              </div>
            </>
          ) : (
            <>
              <DialogTitle>Add User</DialogTitle>
              <div className="mt-4 space-y-4">
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Display Name</Label>
                  <Input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Full name"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Email</Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="user@example.com"
                    className="text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs uppercase text-muted-foreground">Role</Label>
                  <Select
                    value={role}
                    onChange={(e) => setRole((e.target as HTMLSelectElement).value as "admin" | "member")}
                    className="text-sm"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </Select>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
                <Button
                  size="sm"
                  onClick={handleSubmit}
                  disabled={createUser.isPending}
                >
                  {createUser.isPending ? "Creating..." : "Create User"}
                </Button>
              </div>
            </>
          )}
        </DialogPopup>
      </DialogPortal>
    </Dialog>
  );
}
