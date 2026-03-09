import { DashboardClient } from "@/components/dashboard/dashboard-client";
import { RecentActivity } from "@/components/dashboard/recent-activity";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your personal hub overview
        </p>
      </div>
      <DashboardClient />
      <RecentActivity />
    </div>
  );
}
