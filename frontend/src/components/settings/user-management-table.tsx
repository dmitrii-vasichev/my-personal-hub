"use client";

import { UserPlus } from "lucide-react";
import { useState } from "react";
import { useUsers } from "@/hooks/use-users";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { UserActionsMenu } from "./user-actions-menu";
import { CreateUserDialog } from "./create-user-dialog";
import type { UserListItem } from "@/types/user";

function RoleBadge({ role }: { role: string }) {
  const isAdmin = role === "admin";
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]"
      style={{
        background: isAdmin ? "var(--accent-muted)" : "var(--accent-teal-muted)",
        color: isAdmin ? "var(--primary)" : "var(--accent-teal)",
        border: `1px solid ${isAdmin ? "rgba(79,143,234,0.20)" : "rgba(61,214,140,0.20)"}`,
      }}
    >
      {isAdmin ? "Admin" : "Member"}
    </span>
  );
}

function StatusBadge({ blocked }: { blocked: boolean }) {
  if (blocked) {
    return (
      <span
        className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]"
        style={{
          background: "var(--destructive-muted)",
          color: "var(--destructive)",
          border: "1px solid rgba(239,100,100,0.20)",
        }}
      >
        Blocked
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 font-mono text-[11px]"
      style={{
        background: "var(--accent-teal-muted)",
        color: "var(--accent-teal)",
        border: "1px solid rgba(61,214,140,0.20)",
      }}
    >
      Active
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function UserRow({ user }: { user: UserListItem }) {
  return (
    <tr
      className="border-b border-border/30 hover:bg-surface-hover transition-colors"
      style={{ opacity: user.is_blocked ? 0.55 : 1 }}
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Avatar name={user.display_name} size="sm" />
          <div>
            <div className="text-sm font-medium text-foreground">{user.display_name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <RoleBadge role={user.role} />
      </td>
      <td className="px-4 py-3">
        <StatusBadge blocked={user.is_blocked} />
      </td>
      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
        {formatDate(user.last_login_at)}
      </td>
      <td className="px-4 py-3">
        <div className="flex justify-end">
          <UserActionsMenu user={user} />
        </div>
      </td>
    </tr>
  );
}

export function UserManagementTable() {
  const { data: users, isLoading } = useUsers();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">User Management</h2>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <UserPlus className="mr-1.5 h-3.5 w-3.5" />
          Add User
        </Button>
      </div>

      {isLoading ? (
        <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
          Loading users…
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-hover">
                <th className="px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-[0.5px] text-muted-foreground">
                  User
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-[0.5px] text-muted-foreground">
                  Role
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-[0.5px] text-muted-foreground">
                  Status
                </th>
                <th className="px-4 py-2.5 text-left font-mono text-[10.5px] uppercase tracking-[0.5px] text-muted-foreground">
                  Last Login
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {users?.map((u) => (
                <UserRow key={u.id} user={u} />
              ))}
              {users?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      <CreateUserDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
