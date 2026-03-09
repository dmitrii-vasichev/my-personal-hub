"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TaskDialog } from "@/components/tasks/task-dialog";

export default function DashboardPage() {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div
        className="flex items-start justify-between"
        style={{ animation: "fadeSlideUp 0.5s ease 0.1s both" }}
      >
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-tertiary">Your personal hub overview</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowCreateDialog(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Plus size={15} />
            New Task
          </button>
        </div>
      </div>

      {/* Stat cards */}
      <DashboardClient />

      {/* Recent activity — full width */}
      <RecentActivity />

      {/* Task creation modal */}
      {showCreateDialog && (
        <TaskDialog
          mode="create"
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => router.push("/tasks")}
        />
      )}
    </div>
  );
}
