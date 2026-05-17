import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppShell } from "../app-shell";

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({
    user: { id: 1, display_name: "Dmitrii" },
    isLoading: false,
  }),
}));

vi.mock("@/components/reminders/reminder-poller", () => ({
  ReminderPoller: () => null,
}));

vi.mock("../header", () => ({
  Header: () => <header data-testid="header" />,
}));

vi.mock("../sidebar", () => ({
  Sidebar: () => <aside data-testid="sidebar" />,
}));

describe("AppShell", () => {
  it("shows Andryukha greeting only in the mobile footer", () => {
    render(
      <AppShell>
        <section>Dashboard content</section>
      </AppShell>,
    );

    const greeting = screen.getByText("Привет, Андрюха!");

    expect(greeting).toBeInTheDocument();
    expect(greeting.className).toContain("md:hidden");
  });
});
