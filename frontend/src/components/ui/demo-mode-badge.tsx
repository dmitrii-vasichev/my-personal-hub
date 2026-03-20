import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";

interface DemoModeBadgeProps {
  feature: string;
  description: string;
  compact?: boolean;
  className?: string;
}

export function DemoModeBadge({
  feature,
  description,
  compact = false,
  className,
}: DemoModeBadgeProps) {
  if (compact) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground",
          className
        )}
      >
        <Lock className="h-3 w-3" />
        <span>Demo Mode</span>
      </span>
    );
  }

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-4",
        className
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
        <Lock className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium leading-none">Demo Mode</p>
        <p className="text-xs text-muted-foreground">
          {feature} — {description}
        </p>
      </div>
    </div>
  );
}
