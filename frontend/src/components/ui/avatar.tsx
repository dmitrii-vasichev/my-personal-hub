"use client";

import { getInitials, getAvatarHexColor } from "@/lib/avatar";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { outer: "h-7 w-7 text-[11px]", ring: "" },
  md: { outer: "h-9 w-9 text-[13px]", ring: "" },
  lg: { outer: "h-16 w-16 text-[22px]", ring: "ring-2 ring-border" },
};

export function Avatar({ name, size = "sm", className }: AvatarProps) {
  const initials = getInitials(name);
  const bg = getAvatarHexColor(name);

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-full font-semibold text-white shrink-0",
        sizeMap[size].outer,
        sizeMap[size].ring,
        className
      )}
      style={{ backgroundColor: bg }}
      title={name}
      aria-label={`Avatar for ${name}`}
    >
      {initials}
    </div>
  );
}
