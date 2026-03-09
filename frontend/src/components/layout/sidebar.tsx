"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CheckSquare,
  Briefcase,
  Calendar,
  Settings,
  User,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const navItems = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  { label: "Job Hunt", href: "/jobs", icon: Briefcase },
  { label: "Calendar", href: "/calendar", icon: Calendar },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Profile", href: "/profile", icon: User },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border bg-surface transition-all duration-200",
        collapsed ? "w-12" : "w-[220px]"
      )}
    >
      <div className={cn("flex items-center border-b border-border", collapsed ? "h-12 justify-center px-3" : "flex-col items-start px-[18px] py-4 gap-0.5")}>
        {!collapsed && (
          <div>
            <div className="text-[15px] font-bold tracking-tight text-foreground">Personal Hub</div>
            <div className="text-[10px] font-mono uppercase tracking-[2px] text-primary">Portal</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 px-2 py-3">
        {!collapsed && (
          <span className="mb-1.5 block px-[18px] pt-3.5 pb-1.5 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-[#4b5563]">
            Modules
          </span>
        )}
        {navItems.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-[9px] rounded-none px-[18px] py-[7px] text-[13.5px] transition-all duration-150",
                isActive
                  ? "bg-accent text-accent-foreground font-medium border-r-2 border-r-primary"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-4 w-4 shrink-0", isActive ? "opacity-100" : "opacity-80")} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
