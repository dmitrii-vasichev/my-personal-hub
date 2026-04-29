import { describe, it, expect, vi, beforeEach } from "vitest";

const redirectMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import TaskDetailPage from "@/app/(dashboard)/tasks/[id]/page";

describe("TaskDetailPage legacy route", () => {
  beforeEach(() => {
    redirectMock.mockClear();
  });

  it("redirects to Actions instead of rendering the archived task detail UI", () => {
    TaskDetailPage();

    expect(redirectMock).toHaveBeenCalledWith("/actions");
  });
});
