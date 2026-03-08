import { cn } from "@/lib/utils";
import type { TextareaHTMLAttributes } from "react";

function Textarea({
  className,
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] outline-none transition-colors focus:border-[var(--accent)] disabled:opacity-50 resize-none",
        className
      )}
      {...props}
    />
  );
}

export { Textarea };
