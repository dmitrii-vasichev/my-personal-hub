import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Header } from "../header";
import { Sidebar } from "../sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/vitals",
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    isDemo: false,
    user: null,
    logout: vi.fn(),
  }),
}));

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({
    data: { connected: true },
    isLoading: false,
  }),
}));

vi.mock("@/components/command-palette-trigger", () => ({
  CommandPaletteTrigger: () => <button type="button">Search</button>,
}));

vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <button type="button">Theme</button>,
}));

describe("Layout chrome alignment", () => {
  it("keeps the desktop header border aligned with the sidebar brand border", () => {
    const { container: sidebarContainer } = render(
      <Sidebar collapsed={false} onToggle={() => undefined} />,
    );
    const { container: headerContainer } = render(<Header />);

    const sidebarBrand = sidebarContainer.querySelector("aside > div");
    const header = headerContainer.querySelector("header");

    expect(sidebarBrand?.className).toContain("h-12");
    expect(header?.className).toContain("md:min-h-12");
  });
});
