import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";

// --- Mock setup ---

const mockConnectMutateAsync = vi.fn();
const mockDisconnectMutateAsync = vi.fn();
const mockSyncMutate = vi.fn();
const mockUpdateIntervalMutate = vi.fn();

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
  useConnectGarmin: () => ({
    mutateAsync: mockConnectMutateAsync,
    isPending: false,
  }),
  useDisconnectGarmin: () => ({
    mutateAsync: mockDisconnectMutateAsync,
    isPending: false,
  }),
  useSyncVitals: () => ({
    mutate: mockSyncMutate,
    isPending: false,
  }),
  useUpdateSyncInterval: () => ({
    mutate: mockUpdateIntervalMutate,
    isPending: false,
  }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock date-fns formatDistanceToNow for deterministic output
vi.mock("date-fns", () => ({
  formatDistanceToNow: () => "2 hours ago",
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
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    expect(screen.getByTestId("garmin-loading")).toBeInTheDocument();
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

    // Email and password fields should be visible
    expect(screen.getByTestId("garmin-email")).toBeInTheDocument();
    expect(screen.getByTestId("garmin-password")).toBeInTheDocument();
    expect(screen.getByTestId("garmin-connect-btn")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();

    // Disconnect and Sync buttons should NOT be visible
    expect(screen.queryByTestId("garmin-disconnect-btn")).not.toBeInTheDocument();
    expect(screen.queryByTestId("garmin-sync-btn")).not.toBeInTheDocument();
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

    // Disconnect and Sync buttons should be visible
    expect(screen.getByTestId("garmin-disconnect-btn")).toBeInTheDocument();
    expect(screen.getByTestId("garmin-sync-btn")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
    expect(screen.getByText("Sync now")).toBeInTheDocument();

    // Sync interval select should show "Every 4h" (240 minutes)
    expect(screen.getByText("Every 4h")).toBeInTheDocument();

    // Last sync should be shown
    expect(screen.getByText("2 hours ago")).toBeInTheDocument();

    // Email and password fields should NOT be visible
    expect(screen.queryByTestId("garmin-email")).not.toBeInTheDocument();
    expect(screen.queryByTestId("garmin-password")).not.toBeInTheDocument();
  });

  it("calls connect API with email and password on form submit", async () => {
    mockConnectionData = {
      connected: false,
      last_sync_at: null,
      sync_status: null,
      sync_error: null,
      sync_interval_minutes: null,
      connected_at: null,
    };
    mockConnectMutateAsync.mockResolvedValue({
      connected: true,
      last_sync_at: null,
      sync_status: null,
      sync_error: null,
      sync_interval_minutes: 240,
      connected_at: "2026-03-20T12:00:00Z",
    });

    const user = userEvent.setup();
    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    const emailInput = screen.getByTestId("garmin-email");
    const passwordInput = screen.getByTestId("garmin-password");
    const connectBtn = screen.getByTestId("garmin-connect-btn");

    await user.type(emailInput, "test@garmin.com");
    await user.type(passwordInput, "secret123");
    await user.click(connectBtn);

    await waitFor(() => {
      expect(mockConnectMutateAsync).toHaveBeenCalledWith({
        email: "test@garmin.com",
        password: "secret123",
      });
    });
  });

  it("disables connect button when email or password is empty", async () => {
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

    const connectBtn = screen.getByTestId("garmin-connect-btn");
    expect(connectBtn).toBeDisabled();
  });

  it("calls sync mutation when Sync now is clicked", async () => {
    mockConnectionData = {
      connected: true,
      last_sync_at: "2026-03-20T12:00:00Z",
      sync_status: "ok",
      sync_error: null,
      sync_interval_minutes: 240,
      connected_at: "2026-03-15T10:00:00Z",
    };

    const user = userEvent.setup();
    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    await user.click(screen.getByTestId("garmin-sync-btn"));

    expect(mockSyncMutate).toHaveBeenCalled();
  });

  it("displays sync error when present", async () => {
    mockConnectionData = {
      connected: true,
      last_sync_at: "2026-03-20T12:00:00Z",
      sync_status: "error",
      sync_error: "Invalid credentials",
      sync_interval_minutes: 240,
      connected_at: "2026-03-15T10:00:00Z",
    };

    const { GarminSettingsTab } = await import(
      "@/components/settings/garmin-tab"
    );
    render(<GarminSettingsTab />, { wrapper: createWrapper() });

    expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
  });
});
