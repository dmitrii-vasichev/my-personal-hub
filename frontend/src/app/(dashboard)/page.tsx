"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { PulseDigestWidget } from "@/components/dashboard/pulse-digest-widget";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { TaskDialog } from "@/components/tasks/task-dialog";

export default function DashboardPage() {
  const router = useRouter();
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
          <p className="mt-1 text-sm text-tertiary">Your personal hub overview</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => setShowCreateDialog(true)}
            className="gap-1.5"
          >
            <Plus className="h-4 w-4" />
            New Task
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <DashboardClient />

      {/* Pulse digest widget */}
      <PulseDigestWidget />

      {/* Recent activity — full width */}
      <RecentActivity />

      {/* Task creation modal */}
      {showCreateDialog && (
        <TaskDialog
          onClose={() => setShowCreateDialog(false)}
          onSuccess={() => router.push("/tasks")}
        />
      )}
    </div>
  );
}
