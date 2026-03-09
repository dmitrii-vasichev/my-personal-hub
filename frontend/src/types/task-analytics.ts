export interface StatusDistributionItem {
  status: string;
  count: number;
}

export interface PriorityDistributionItem {
  priority: string;
  count: number;
}

export interface CompletionRatePoint {
  week: string;
  created: number;
  done: number;
  rate: number;
}

export interface OverdueTask {
  id: number;
  title: string;
  deadline: string;
  priority: string;
}

export interface OverdueData {
  count: number;
  tasks: OverdueTask[];
}
