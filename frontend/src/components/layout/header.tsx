"use client";

import Link from "next/link";
import { LogOut, Menu } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar } from "@/components/ui/avatar";
import { Tooltip } from "@/components/ui/tooltip";

interface HeaderProps {
  onMenuToggle?: () => void;
  showMenuButton?: boolean;
}

export function Header({ onMenuToggle, showMenuButton }: HeaderProps) {
  const { user, logout } = useAuth();

  return (
    <header className="flex h-12 items-center justify-between border-b border-border bg-surface px-4">
      <div className="flex items-center gap-2">
        {showMenuButton && (
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={onMenuToggle}>
            <Menu className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="flex items-center gap-2">
        <ThemeToggle />
        {user && (
          <>
            <Tooltip content="View profile">
              <Link href="/profile" className="hover:opacity-80 transition-opacity">
                <Avatar name={user.display_name} size="sm" />
              </Link>
            </Tooltip>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={logout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
    </header>
  );
}
