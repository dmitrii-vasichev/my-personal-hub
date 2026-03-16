import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TelegramTab } from "@/components/settings/telegram-tab";

const mockStartAuth = vi.fn().mockResolvedValue({ ok: true });
const mockVerifyCode = vi.fn().mockResolvedValue({ connected: true });
const mockDisconnect = vi.fn().mockResolvedValue(undefined);

const mockUseTelegramStatus = vi.fn();

vi.mock("@/hooks/use-telegram", () => ({
  useTelegramStatus: (...args: unknown[]) => mockUseTelegramStatus(...args),
  useTelegramStartAuth: () => ({
    mutateAsync: mockStartAuth,
    isPending: false,
  }),
  useTelegramVerifyCode: () => ({
    mutateAsync: mockVerifyCode,
    isPending: false,
  }),
  useTelegramDisconnect: () => ({
    mutateAsync: mockDisconnect,
    isPending: false,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

function Wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

describe("TelegramTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders disconnected state with phone input", () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { connected: false, phone_number: null, connected_at: null },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    expect(screen.getByText("Telegram Connection")).toBeInTheDocument();
    expect(screen.getByText("Not connected")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("+7 900 123 4567")).toBeInTheDocument();
    expect(screen.getByText("Connect")).toBeInTheDocument();
  });

  it("renders connected state with status and disconnect button", () => {
    mockUseTelegramStatus.mockReturnValue({
      data: {
        connected: true,
        phone_number: "***4567",
        connected_at: "2026-03-16T12:00:00Z",
      },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    expect(screen.getByText("✓ Connected")).toBeInTheDocument();
    expect(screen.getByText("***4567")).toBeInTheDocument();
    expect(screen.getByText("Disconnect")).toBeInTheDocument();
  });

  it("submits phone number on connect", async () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { connected: false, phone_number: null, connected_at: null },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    const phoneInput = screen.getByPlaceholderText("+7 900 123 4567");
    fireEvent.change(phoneInput, { target: { value: "+79001234567" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(mockStartAuth).toHaveBeenCalledWith({
        phone_number: "+79001234567",
      });
    });
  });

  it("renders code verification form after start-auth", async () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { connected: false, phone_number: null, connected_at: null },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    // Trigger start auth
    const phoneInput = screen.getByPlaceholderText("+7 900 123 4567");
    fireEvent.change(phoneInput, { target: { value: "+79001234567" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("Awaiting code")).toBeInTheDocument();
      expect(screen.getByPlaceholderText("12345")).toBeInTheDocument();
      expect(screen.getByText("Verify")).toBeInTheDocument();
    });
  });

  it("submits verification code", async () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { connected: false, phone_number: null, connected_at: null },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    // Go to code step
    const phoneInput = screen.getByPlaceholderText("+7 900 123 4567");
    fireEvent.change(phoneInput, { target: { value: "+79001234567" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("12345")).toBeInTheDocument();
    });

    const codeInput = screen.getByPlaceholderText("12345");
    fireEvent.change(codeInput, { target: { value: "99999" } });
    fireEvent.click(screen.getByText("Verify"));

    await waitFor(() => {
      expect(mockVerifyCode).toHaveBeenCalledWith({ code: "99999" });
    });
  });

  it("shows 2FA password field when toggled", async () => {
    mockUseTelegramStatus.mockReturnValue({
      data: { connected: false, phone_number: null, connected_at: null },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    // Go to code step
    const phoneInput = screen.getByPlaceholderText("+7 900 123 4567");
    fireEvent.change(phoneInput, { target: { value: "+79001234567" } });
    fireEvent.click(screen.getByText("Connect"));

    await waitFor(() => {
      expect(screen.getByText("I have two-factor authentication enabled")).toBeInTheDocument();
    });

    // Toggle 2FA checkbox
    fireEvent.click(screen.getByLabelText("I have two-factor authentication enabled"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Your 2FA password")).toBeInTheDocument();
    });
  });

  it("shows confirmation dialog on disconnect", async () => {
    mockUseTelegramStatus.mockReturnValue({
      data: {
        connected: true,
        phone_number: "***4567",
        connected_at: "2026-03-16T12:00:00Z",
      },
      isLoading: false,
    });

    render(
      <Wrapper>
        <TelegramTab />
      </Wrapper>
    );

    fireEvent.click(screen.getByText("Disconnect"));

    await waitFor(() => {
      expect(screen.getByText("Disconnect Telegram")).toBeInTheDocument();
      expect(
        screen.getByText(
          "This will revoke your Telegram session. You'll need to reconnect to use Pulse features."
        )
      ).toBeInTheDocument();
    });
  });
});
