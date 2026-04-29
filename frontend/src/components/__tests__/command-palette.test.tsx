import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/hooks/use-command-palette";
import type { ReactNode } from "react";

const vitalsMock = vi.hoisted(() => ({ connected: false }));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isDemo: false, user: null }),
}));

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({
    data: { connected: vitalsMock.connected },
    isLoading: false,
  }),
}));

function setup() {
  return render(
    <CommandPaletteProvider>
      <CommandPalette />
    </CommandPaletteProvider> as ReactNode
  );
}

describe("<CommandPalette />", () => {
  beforeEach(() => {
    mockPush.mockClear();
    vitalsMock.connected = false;
    window.localStorage.clear();
  });

  it("is closed by default (input not rendered)", () => {
    setup();
    expect(screen.queryByPlaceholderText(/search or type/i)).not.toBeInTheDocument();
  });

  it("opens on Cmd+K and renders QUICK ACTIONS + JUMP TO sections", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByPlaceholderText(/search or type/i)).toBeVisible();
    expect(screen.getByText("QUICK ACTIONS")).toBeInTheDocument();
    expect(screen.getByText("JUMP TO")).toBeInTheDocument();
    // History is empty → RECENT hidden.
    expect(screen.queryByText("RECENT")).not.toBeInTheDocument();
  });

  it("filters items as the user types", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText(/search or type/i);
    fireEvent.change(input, { target: { value: "task" } });
    expect(screen.getByText("Tasks")).toBeInTheDocument();
    expect(screen.getByText("New task…")).toBeInTheDocument();
    // Non-matching routes drop out.
    expect(screen.queryByText("Reminders")).not.toBeInTheDocument();
    expect(screen.queryByText("Meetings")).not.toBeInTheDocument();
  });

  it("routes via router.push when an item is clicked", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(screen.getByText("Tasks"));
    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  it("hides Vitals when Garmin is not connected", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.queryByText("Vitals")).not.toBeInTheDocument();
  });

  it("shows Vitals when Garmin is connected", () => {
    vitalsMock.connected = true;

    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });

    expect(screen.getByText("Vitals")).toBeInTheDocument();
  });

  it("shows 'No results' on zero filter matches", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText(/search or type/i);
    fireEvent.change(input, { target: { value: "zzznothingmatches" } });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });

  it("renders entities from hub-recent-entities in the RECENT section", () => {
    window.localStorage.setItem(
      "hub-recent-entities",
      JSON.stringify([
        {
          kind: "job",
          id: 77,
          label: "Acme · Senior Engineer",
          href: "/jobs/77",
          visitedAt: 200,
        },
        {
          kind: "task",
          id: 42,
          label: "#42 · Fix login bug",
          href: "/tasks/42",
          visitedAt: 100,
        },
      ]),
    );
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    expect(screen.getByText("RECENT")).toBeInTheDocument();
    expect(screen.getByText("Acme · Senior Engineer")).toBeInTheDocument();
    expect(screen.getByText("#42 · Fix login bug")).toBeInTheDocument();
  });

  it("routes to entity href when a recent entity is clicked", () => {
    window.localStorage.setItem(
      "hub-recent-entities",
      JSON.stringify([
        {
          kind: "task",
          id: 42,
          label: "#42 · Fix login bug",
          href: "/tasks/42",
          visitedAt: 100,
        },
      ]),
    );
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    fireEvent.click(screen.getByText("#42 · Fix login bug"));
    expect(mockPush).toHaveBeenCalledWith("/tasks/42");
  });
});
