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
import { useAuth } from "@/lib/auth";

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
  const { user } = useAuth();

  const initials = user?.display_name
    ? user.display_name.slice(0, 1).toUpperCase()
    : "U";

  return (
    <aside
      className={cn(
        "flex h-screen flex-col border-r border-border-subtle bg-surface transition-all duration-200 animate-[fadeIn_0.4s_ease_both]",
        collapsed ? "w-12" : "w-[220px]"
      )}
    >
      {/* Logo */}
      <div className={cn(
        "flex items-center border-b border-border-subtle",
        collapsed ? "h-12 justify-center px-3" : "flex-col items-start px-[18px] py-4 gap-0.5"
      )}>
        {!collapsed && (
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-foreground">Personal Hub</div>
            <div className="text-[11px] uppercase tracking-[0.06em] text-tertiary font-medium mt-0.5">PORTAL</div>
          </div>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onToggle}>
          {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-2 py-3">
        {!collapsed && (
          <span className="mb-1.5 block px-[10px] pt-3.5 pb-1.5 font-mono text-[9px] font-medium uppercase tracking-[1.5px] text-tertiary">
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
                "relative flex items-center gap-[10px] rounded-lg px-[10px] py-[8px] text-[14px] transition-all duration-150",
                isActive
                  ? "bg-surface-hover text-foreground font-medium"
                  : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                collapsed && "justify-center px-0"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className={cn("h-[17px] w-[17px] shrink-0", isActive ? "opacity-100" : "opacity-60")} />
              {!collapsed && <span>{item.label}</span>}
              {/* Vertical accent indicator */}
              {isActive && (
                <div className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-[16px] bg-primary rounded-[2px]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom user section */}
      <div className="border-t border-border-subtle px-2 py-3">
        <div className={cn(
          "flex items-center gap-[10px] px-[10px] py-[8px] rounded-lg",
          collapsed && "justify-center px-0"
        )}>
          {/* Gradient avatar badge */}
          <div
            className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-white text-[12px] font-semibold shrink-0"
            style={{ background: "linear-gradient(135deg, #4f8fea, #7c5ce0)" }}
          >
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <div className="text-[13px] font-medium text-foreground truncate">
                {user?.display_name ?? "User"}
              </div>
              <div className="text-[11px] text-tertiary truncate">
                {user?.email ?? ""}
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
