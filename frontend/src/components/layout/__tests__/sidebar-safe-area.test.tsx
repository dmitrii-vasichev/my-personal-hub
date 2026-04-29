import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Sidebar } from "../sidebar";

const vitalsMock = vi.hoisted(() => ({ connected: false }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/reminders",
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isDemo: false }),
}));

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({
    data: { connected: vitalsMock.connected },
    isLoading: false,
  }),
}));

describe("Sidebar safe area", () => {
  beforeEach(() => {
    vitalsMock.connected = false;
  });

  it("keeps mobile overlay content below iOS system chrome", () => {
    const { container } = render(
      <Sidebar collapsed={false} onToggle={() => undefined} />,
    );

    const sidebar = container.querySelector("aside");

    expect(sidebar?.className).toContain("max-md:pt-[var(--safe-top)]");
    expect(sidebar?.className).toContain("max-md:pb-[var(--safe-bottom)]");
    expect(sidebar?.className).toContain("max-md:pl-[var(--safe-left)]");
  });

  it("hides Vitals when Garmin is not connected", () => {
    render(<Sidebar collapsed={false} onToggle={() => undefined} />);

    expect(screen.queryByText("Vitals")).not.toBeInTheDocument();
  });

  it("shows Vitals when Garmin is connected", () => {
    vitalsMock.connected = true;

    render(<Sidebar collapsed={false} onToggle={() => undefined} />);

    expect(screen.getByText("Vitals")).toBeInTheDocument();
  });
});
