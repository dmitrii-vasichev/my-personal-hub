"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

type NavItem = {
  label: string;
  href: string;
  glyph: string;
  hideForDemo?: boolean;
};

type NavSection = {
  title: string;
  items: NavItem[];
};

const navSections: NavSection[] = [
  {
    title: "Daily",
    items: [
      { label: "Today", href: "/", glyph: "◉" },
      { label: "Tasks", href: "/tasks", glyph: "▦" },
      { label: "Reminders", href: "/reminders", glyph: "◷" },
      { label: "Meetings", href: "/calendar", glyph: "◧" },
    ],
  },
  {
    title: "Projects",
    items: [
      { label: "Job Hunt", href: "/jobs", glyph: "▤" },
      { label: "Outreach", href: "/outreach", glyph: "◈", hideForDemo: true },
      { label: "Notes", href: "/notes", glyph: "▨" },
    ],
  },
  {
    title: "Signals",
    items: [{ label: "Pulse", href: "/pulse", glyph: "◐" }],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/settings", glyph: "◇" },
      { label: "Profile", href: "/profile", glyph: "▢" },
    ],
  },
];

interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onNavClick?: () => void;
}

export function Sidebar({ collapsed, onToggle, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const { isDemo } = useAuth();

  return (
    <aside
      className={cn(
        "flex h-screen flex-col bg-[color:var(--bg)] border-r border-[color:var(--line)] transition-[width] duration-150",
        collapsed ? "w-12" : "w-[220px]"
      )}
    >
      {/* Brand */}
      <div
        className={cn(
          "flex items-center border-b border-[color:var(--line)] h-12 shrink-0",
          collapsed ? "justify-center" : "justify-between px-[18px]"
        )}
      >
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 cursor-pointer"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span
            className="inline-block w-[14px] h-[14px] bg-[color:var(--accent)]"
            aria-hidden
          />
          {!collapsed && (
            <b className="font-[family-name:var(--font-space-grotesk)] font-bold text-[22px] tracking-[-0.8px] text-[color:var(--ink)]">
              HUB_
            </b>
          )}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-2">
        {navSections.map((section) => {
          const visibleItems = section.items.filter(
            (item) => !(item.hideForDemo && isDemo)
          );
          if (visibleItems.length === 0) return null;

          return (
            <div key={section.title}>
              {!collapsed && (
                <div className="px-[18px] pt-[14px] pb-[6px] text-[9.5px] font-medium uppercase tracking-[2.5px] text-[color:var(--ink-3)]">
                  {section.title}
                </div>
              )}
              {collapsed && (
                <div className="h-[1px] bg-[color:var(--line)] my-2 mx-2" aria-hidden />
              )}
              {visibleItems.map((item) => {
                const isActive =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={onNavClick}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "flex items-center gap-[10px] py-[8px] text-[12px] tracking-[0.2px] transition-colors border-l-[3px]",
                      collapsed ? "justify-center px-0" : "px-[18px]",
                      isActive
                        ? "bg-[color:var(--bg-2)] text-[color:var(--ink)] font-semibold border-[color:var(--accent)]"
                        : "text-[color:var(--ink-2)] border-transparent hover:bg-[color:var(--bg-2)] hover:text-[color:var(--ink)]"
                    )}
                  >
                    <span
                      className={cn(
                        "w-4 text-center text-[12px] shrink-0",
                        isActive
                          ? "text-[color:var(--accent)]"
                          : "text-[color:var(--ink-3)]"
                      )}
                      aria-hidden
                    >
                      {item.glyph}
                    </span>
                    {!collapsed && <span className="truncate">{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div
        className={cn(
          "border-t border-[color:var(--line)] py-[12px] text-[10px] tracking-[0.5px] text-[color:var(--ink-3)] shrink-0",
          collapsed ? "px-2 flex justify-center" : "px-[18px] flex justify-between items-center"
        )}
      >
        <span className="flex items-center gap-[6px]">
          <span
            className="inline-block w-[6px] h-[6px] rounded-full bg-[color:var(--accent)]"
            style={{ boxShadow: "0 0 6px var(--accent)" }}
            aria-hidden
          />
          {!collapsed && <span>synced</span>}
        </span>
        {!collapsed && <span>v0.1.0</span>}
      </div>
    </aside>
  );
}
