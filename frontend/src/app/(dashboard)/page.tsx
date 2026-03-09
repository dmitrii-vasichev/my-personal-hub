import Link from "next/link";
import { Plus } from "lucide-react";
import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { QuickActions } from "@/components/dashboard/quick-actions";

export default function DashboardPage() {
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
          <Link
            href="/tasks"
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-[13px] font-medium text-primary-foreground transition-opacity duration-150 hover:opacity-90"
          >
            <Plus size={15} />
            New Task
          </Link>
        </div>
      </div>

      {/* Stat cards */}
      <DashboardClient />

      {/* Content grid: activity + quick actions */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_260px]">
        <RecentActivity />
        <QuickActions />
      </div>
    </div>
  );
}
