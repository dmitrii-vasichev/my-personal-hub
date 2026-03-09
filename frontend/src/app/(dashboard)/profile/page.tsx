"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Save, Key } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useProfile, useUpdateProfile } from "@/hooks/use-profile";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/lib/api";

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]"
      style={{
        background: isAdmin ? "rgba(79,142,247,0.10)" : "rgba(45,212,191,0.10)",
        color: isAdmin ? "#4f8ef7" : "#2dd4bf",
        border: `1px solid ${isAdmin ? "rgba(79,142,247,0.20)" : "rgba(45,212,191,0.20)"}`,
      }}
    >
      {isAdmin ? "Admin" : "Member"}
    </span>
  );
}

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const { data: profile } = useProfile();
  const updateProfile = useUpdateProfile();

  const [displayName, setDisplayName] = useState(user?.display_name ?? "");
  const [nameInitialized, setNameInitialized] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd, setNewPwd] = useState("");
  const [changingPwd, setChangingPwd] = useState(false);

  if (profile && !nameInitialized) {
    setDisplayName(profile.display_name);
    setNameInitialized(true);
  }

  const handleSaveName = async () => {
    try {
      await updateProfile.mutateAsync({ display_name: displayName });
      await refreshUser();
      toast.success("Display name updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update name");
    }
  };

  const handleChangePassword = async () => {
    if (!currentPwd || !newPwd) {
      toast.error("Both fields are required");
      return;
    }
    if (newPwd.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (currentPwd === newPwd) {
      toast.error("New password must differ from current password");
      return;
    }
    setChangingPwd(true);
    try {
      await api.post("/api/auth/change-password", {
        current_password: currentPwd,
        new_password: newPwd,
      });
      setCurrentPwd("");
      setNewPwd("");
      toast.success("Password changed successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to change password");
    } finally {
      setChangingPwd(false);
    }
  };

  const name = profile?.display_name ?? user?.display_name ?? "";

  return (
    <div className="mx-auto max-w-xl space-y-8 p-6">
      <h1 className="text-lg font-semibold">Profile</h1>

      {/* Avatar + identity */}
      <section className="flex items-center gap-5 rounded-[14px] border border-border bg-surface p-5">
        <Avatar name={name} size="lg" />
        <div className="space-y-1">
          <div className="text-base font-semibold text-foreground">{name}</div>
          <div className="text-sm text-muted-foreground">{profile?.email ?? user?.email}</div>
          <div className="flex items-center gap-2 pt-0.5">
            <RoleBadge role={profile?.role ?? user?.role ?? "member"} />
          </div>
        </div>
      </section>

      {/* Edit display name */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="text-sm font-medium">Display Name</h2>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Name</Label>
          <Input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Email</Label>
          <Input
            value={profile?.email ?? user?.email ?? ""}
            disabled
            className="text-sm opacity-60"
          />
          <p className="text-xs text-muted-foreground">Email cannot be changed</p>
        </div>
        <Button
          size="sm"
          onClick={handleSaveName}
          disabled={updateProfile.isPending || !displayName.trim()}
        >
          <Save className="mr-1.5 h-3.5 w-3.5" />
          {updateProfile.isPending ? "Saving…" : "Save name"}
        </Button>
      </section>

      {/* Change password */}
      <section className="space-y-4 rounded-[14px] border border-border p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <Key className="h-4 w-4 text-muted-foreground" />
          Change Password
        </h2>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">Current Password</Label>
          <Input
            type="password"
            value={currentPwd}
            onChange={(e) => setCurrentPwd(e.target.value)}
            placeholder="Enter current password"
            className="text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs uppercase text-muted-foreground">New Password</Label>
          <Input
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="At least 8 characters"
            className="text-sm"
          />
        </div>
        <Button
          size="sm"
          onClick={handleChangePassword}
          disabled={changingPwd || !currentPwd || !newPwd}
        >
          {changingPwd ? "Changing…" : "Change password"}
        </Button>
      </section>
    </div>
  );
}
