import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PulseSettingsTab } from "@/components/settings/pulse-settings-tab";

const mockSettings = {
  id: 1,
  user_id: 1,
  polling_interval_minutes: 60,
  message_ttl_days: 30,
  digest_schedule: "daily",
  digest_time: "09:00:00",
  bot_token_set: true,
  bot_chat_id: 123456,
  notify_digest_ready: true,
  notify_urgent_jobs: true,
};

const mockMutateAsync = vi.fn().mockResolvedValue({});
const mockPollMutate = vi.fn();
const mockTestBotMutate = vi.fn();

vi.mock("@/hooks/use-pulse-settings", () => ({
  usePulseSettings: () => ({ data: mockSettings, isLoading: false }),
  useUpdatePulseSettings: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  }),
  useTriggerPoll: () => ({
    mutate: mockPollMutate,
    isPending: false,
  }),
  useTestBotConnection: () => ({
    mutate: mockTestBotMutate,
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

describe("PulseSettingsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders pulse settings form", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    expect(screen.getByText("Pulse Configuration")).toBeInTheDocument();
    expect(screen.getByText("Polling Interval (minutes)")).toBeInTheDocument();
    expect(screen.getByText("Message TTL (days)")).toBeInTheDocument();
    expect(screen.getByText("Digest Schedule")).toBeInTheDocument();
    expect(screen.getByText("Digest Time")).toBeInTheDocument();
    expect(screen.getByText("Notifications")).toBeInTheDocument();
  });

  it("updates polling interval", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    const input = screen.getByDisplayValue("60");
    fireEvent.change(input, { target: { value: "30" } });
    expect(input).toHaveValue(30);
  });

  it("shows poll now button", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    const pollBtn = screen.getByText("Poll Now");
    expect(pollBtn).toBeInTheDocument();

    fireEvent.click(pollBtn);
    expect(mockPollMutate).toHaveBeenCalled();
  });

  it("renders bot token input", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    expect(screen.getByText("Bot Token")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Paste token from @BotFather")).toBeInTheDocument();
  });

  it("renders chat ID input", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    expect(screen.getByText("Chat ID")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Your Telegram chat ID")).toBeInTheDocument();
  });

  it("shows token configured indicator when bot_token_set", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    expect(screen.getByText("Token configured")).toBeInTheDocument();
  });

  it("shows test connection button when bot is configured", () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    const testBtn = screen.getByText("Test Connection");
    expect(testBtn).toBeInTheDocument();

    fireEvent.click(testBtn);
    expect(mockTestBotMutate).toHaveBeenCalled();
  });

  it("includes bot fields in save", async () => {
    render(
      <Wrapper>
        <PulseSettingsTab />
      </Wrapper>
    );

    const tokenInput = screen.getByPlaceholderText("Paste token from @BotFather");
    fireEvent.change(tokenInput, { target: { value: "new-token" } });

    const saveBtn = screen.getByText("Save");
    fireEvent.click(saveBtn);

    expect(mockMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        bot_token: "new-token",
        bot_chat_id: 123456,
      })
    );
  });
});
