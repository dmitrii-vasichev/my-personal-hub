import type { Action } from "@/types/action";

export function isInboxAction(action: Action): boolean {
  return action.status !== "done" && !action.action_date && !action.remind_at;
}
