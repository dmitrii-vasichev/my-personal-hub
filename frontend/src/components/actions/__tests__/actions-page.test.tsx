import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ActionsPage from "@/app/(dashboard)/actions/page";
import { QuickAddActionForm } from "../quick-add-action-form";

const mocks = vi.hoisted(() => ({
  createActionMutate: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/actions",
  useRouter: () => ({ replace: mocks.replace }),
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/hooks/use-actions", () => {
  const stub = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false });
  return {
    useActions: () => ({ data: [], isLoading: false, error: null }),
    useCompletedActions: () => ({ data: [], isLoading: false }),
    useCreateAction: () => ({ mutate: mocks.createActionMutate, isPending: false }),
    useUpdateAction: stub,
    useDeleteAction: stub,
    useMarkActionDone: stub,
    useRestoreAction: stub,
    useSnoozeAction: stub,
  };
});

vi.mock("@/hooks/use-birthdays", () => ({
  useBirthdays: () => ({ data: [], isLoading: false, error: null }),
}));

function wrap(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={qc}>{ui}</QueryClientProvider>,
  );
}

describe("Actions page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Actions as the primary section", () => {
    wrap(<ActionsPage />);

    expect(screen.getByText("Module · Actions")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "ACTIONS_" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /history/i })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /legacy review/i })).not.toBeInTheDocument();
  });

  it("creates title-only actions as inbox items", async () => {
    const user = userEvent.setup();
    wrap(<QuickAddActionForm />);

    await user.type(screen.getByPlaceholderText("Action…"), "Read saved article");
    await user.click(screen.getByRole("button", { name: /^add$/i }));

    expect(mocks.createActionMutate).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Read saved article",
        action_date: undefined,
        remind_at: undefined,
      }),
      expect.any(Object),
    );
  });
});
