import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mock data ---

let mockConnectionData: {
  connected: boolean;
  last_sync_at: string | null;
  sync_status: string | null;
  sync_error: string | null;
  sync_interval_minutes: number | null;
  connected_at: string | null;
} | undefined = undefined;

let mockIsLoading = false;

vi.mock("@/hooks/use-vitals", () => ({
  useVitalsConnection: () => ({
    data: mockConnectionData,
    isLoading: mockIsLoading,
  }),
  useSyncVitals: () => ({
    mutate: vi.fn(),
    isPending: false,
  }),
  VITALS_KEY: "vitals",
}));

vi.mock("@/lib/api", () => ({
  api: {
    post: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn(),
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe("GarminSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionData = undefined;
    mockIsLoading = false;
  });

  it("renders loading state", async () => {
    mockIsLoading = true;

    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    const { container } = render(<GarminSettingsTab />, {
      wrapper: createWrapper(),
    });

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("renders disconnected state with email and password inputs", async () => {
    mockConnectionData = {
      connected: false,
      last_sync_at: null,
      sync_status: null,
      sync_error: null,
      sync_interval_minutes: null,
      connected_at: null,
    };

    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    expect(screen.getByPlaceholderText("your@email.com")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Garmin Connect password")
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /connect garmin/i })
    ).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
  });

  it("renders connected state with sync and disconnect buttons", async () => {
    mockConnectionData = {
      connected: true,
      last_sync_at: "2026-03-20T12:00:00Z",
      sync_status: "ok",
      sync_error: null,
      sync_interval_minutes: 240,
      connected_at: "2026-03-15T10:00:00Z",
    };

    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /sync now/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /disconnect/i })
    ).toBeInTheDocument();

    // Email/password fields should NOT be visible
    expect(
      screen.queryByPlaceholderText("your@email.com")
    ).not.toBeInTheDocument();
  });

  it("connect button is disabled when email or password is empty", async () => {
    mockConnectionData = {
      connected: false,
      last_sync_at: null,
      sync_status: null,
      sync_error: null,
      sync_interval_minutes: null,
      connected_at: null,
    };

    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    const connectBtn = screen.getByRole("button", { name: /connect garmin/i });
    expect(connectBtn).toBeDisabled();
  });
});
