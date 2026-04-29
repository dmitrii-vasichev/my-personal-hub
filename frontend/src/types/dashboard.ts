export interface DashboardUpcomingEvent {
  id: number;
  title: string;
  start_time: string;
}

export interface DashboardSummary {
  actions: {
    total: number;
    active: number;
    done: number;
    overdue: number;
    completion_rate: number;
    by_status: Record<string, number>;
  };
  job_hunt: {
    active_applications: number;
    upcoming_interviews: number;
  };
  calendar: {
    upcoming_count: number;
    upcoming_events: DashboardUpcomingEvent[];
  };
}
