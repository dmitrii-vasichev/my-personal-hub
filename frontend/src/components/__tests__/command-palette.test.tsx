import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CommandPalette } from "@/components/command-palette";
import { CommandPaletteProvider } from "@/hooks/use-command-palette";
import type { ReactNode } from "react";

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/auth", () => ({
  useAuth: () => ({ isDemo: false, user: null }),
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

  it("shows 'No results' on zero filter matches", () => {
    setup();
    fireEvent.keyDown(window, { key: "k", metaKey: true });
    const input = screen.getByPlaceholderText(/search or type/i);
    fireEvent.change(input, { target: { value: "zzznothingmatches" } });
    expect(screen.getByText(/no results/i)).toBeInTheDocument();
  });
});
