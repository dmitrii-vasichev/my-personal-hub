import { AppShell } from "@/components/layout/app-shell";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/hooks/use-command-palette";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <CommandPaletteProvider>
      <AppShell>{children}</AppShell>
      <CommandPalette />
    </CommandPaletteProvider>
  );
}
