import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sidebar } from "../sidebar";

vi.mock("next/navigation", () => ({
  usePathname: () => "/reminders",
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isDemo: false }),
}));

describe("Sidebar safe area", () => {
  it("keeps mobile overlay content below iOS system chrome", () => {
    const { container } = render(
      <Sidebar collapsed={false} onToggle={() => undefined} />,
    );

    const sidebar = container.querySelector("aside");

    expect(sidebar?.className).toContain("max-md:pt-[var(--safe-top)]");
    expect(sidebar?.className).toContain("max-md:pb-[var(--safe-bottom)]");
    expect(sidebar?.className).toContain("max-md:pl-[var(--safe-left)]");
  });
});
