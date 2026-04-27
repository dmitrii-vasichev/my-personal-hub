import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { PromptEditor } from "@/components/pulse/prompt-editor";
import type { PulseSettings } from "@/types/pulse-settings";

// Mock the hooks
const mockMutate = vi.fn();
const mockSettings: PulseSettings = {
  id: 1,
  user_id: 1,
  polling_interval_minutes: 60,
  digest_schedule: "daily",
  digest_time: "09:00",
  timezone: "UTC",
  digest_day: null,
  digest_interval_days: null,
  message_ttl_days: 30,
  poll_message_limit: 100,
  bot_token_set: false,
  bot_chat_id: null,
  notify_digest_ready: false,
  notify_urgent_jobs: false,
  prompt_news: null,
  prompt_jobs: null,
  prompt_learning: null,
  updated_at: "2026-01-01T00:00:00Z",
};

const mockDefaults = {
  news: "Default news prompt text for testing",
  jobs: "Default jobs prompt text for testing",
  learning: "Default learning prompt text for testing",
};

vi.mock("@/hooks/use-pulse-settings", () => ({
  usePulseSettings: () => ({ data: mockSettings }),
  useUpdatePulseSettings: () => ({
    mutate: mockMutate,
    isPending: false,
  }),
  usePulsePromptDefaults: () => ({ data: mockDefaults }),
}));

// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
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

describe("PromptEditor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to no custom prompt
    mockSettings.prompt_news = null;
    mockSettings.prompt_jobs = null;
    mockSettings.prompt_learning = null;
  });

  it("renders default tab content when switching to default sub-tab", async () => {
    const user = userEvent.setup();
    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    // Click "default" sub-tab
    await user.click(screen.getByText("default"));

    const defaultTab = screen.getByTestId("default-tab");
    expect(defaultTab).toBeInTheDocument();
    expect(defaultTab).toHaveTextContent("Default news prompt text for testing");
  });

  it("renders custom tab with textarea when prompt is set", async () => {
    mockSettings.prompt_news = "My custom news prompt";

    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    const textarea = screen.getByTestId("prompt-textarea");
    expect(textarea).toBeInTheDocument();
    expect(textarea).toHaveValue("My custom news prompt");
  });

  it("shows 'Using default prompt' message when no custom prompt is set", () => {
    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    expect(screen.getByText(/using default prompt/i)).toBeInTheDocument();
    expect(screen.getByText(/copy default to start customizing/i)).toBeInTheDocument();
  });

  it("calls mutation on save button click", async () => {
    mockSettings.prompt_news = "Original prompt";

    const user = userEvent.setup();
    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    const textarea = screen.getByTestId("prompt-textarea");
    await user.clear(textarea);
    await user.type(textarea, "Updated prompt");

    const saveButton = screen.getByTestId("save-button");
    await user.click(saveButton);

    expect(mockMutate).toHaveBeenCalledWith(
      { prompt_news: "Updated prompt" },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("calls mutation with null on reset button click", async () => {
    mockSettings.prompt_news = "Custom prompt to reset";

    const user = userEvent.setup();
    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    const resetButton = screen.getByTestId("reset-button");
    await user.click(resetButton);

    expect(mockMutate).toHaveBeenCalledWith(
      { prompt_news: null },
      expect.objectContaining({ onSuccess: expect.any(Function) })
    );
  });

  it("displays character count correctly", async () => {
    mockSettings.prompt_jobs = "Hello";

    render(<PromptEditor category="jobs" />, { wrapper: createWrapper() });

    const charCount = screen.getByTestId("char-count");
    expect(charCount).toHaveTextContent("5 / 5000");
  });

  it("copies default prompt when 'Copy default to start customizing' is clicked", async () => {
    const user = userEvent.setup();
    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    await user.click(screen.getByText(/copy default to start customizing/i));

    const textarea = screen.getByTestId("prompt-textarea");
    expect(textarea).toHaveValue("Default news prompt text for testing");
  });

  it("copies default prompt from default tab and switches to custom", async () => {
    const user = userEvent.setup();
    mockSettings.prompt_news = "Existing prompt";

    render(<PromptEditor category="news" />, { wrapper: createWrapper() });

    // Switch to default tab
    await user.click(screen.getByText("default"));
    expect(screen.getByTestId("default-tab")).toBeInTheDocument();

    // Click "Copy to custom"
    await user.click(screen.getByText(/copy to custom/i));

    // Should switch back to custom tab with textarea
    const textarea = screen.getByTestId("prompt-textarea");
    expect(textarea).toHaveValue("Default news prompt text for testing");
  });
});
