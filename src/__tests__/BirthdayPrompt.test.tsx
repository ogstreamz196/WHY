import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fns = vi.hoisted(() => ({
  getAdultStatus: vi.fn(),
  saveMyBirthDate: vi.fn(),
}));
vi.mock("@/lib/adult.functions", () => fns);
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({
  useCurrentUser: () => ({ user: { id: "u1", email: "a@b.c" }, loading: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/home" } }),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BirthdayPrompt } from "../components/BirthdayPrompt";

const WEB_UA = navigator.userAgent;
const setUA = (ua: string) =>
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });

function renderPrompt() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BirthdayPrompt />
    </QueryClientProvider>,
  );
}

async function settle() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(2000);
  });
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  sessionStorage.clear();
  fns.getAdultStatus.mockReset();
  fns.saveMyBirthDate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setUA(WEB_UA);
});

describe("BirthdayPrompt", () => {
  it("asks website users without a saved birthday, neutrally", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: false,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    expect(await screen.findByText("When were you born?")).toBeTruthy();
    expect(screen.getByText(/please be accurate/i)).toBeTruthy();
    // No mention of 18+ before the birthday is known.
    expect(screen.queryByText(/18\+|adult/i)).toBeNull();
  });

  it("saves the birthday and re-checks, so adults get the 18+ switch", async () => {
    fns.getAdultStatus
      .mockResolvedValueOnce({ birthdate_known: false, available: false, mode_enabled: false })
      .mockResolvedValue({ birthdate_known: true, available: true, mode_enabled: false });
    fns.saveMyBirthDate.mockResolvedValue({ ok: true });
    renderPrompt();
    await settle();
    fireEvent.change(await screen.findByLabelText("Birth month"), { target: { value: "4" } });
    fireEvent.change(screen.getByLabelText("Birth year"), { target: { value: "1990" } });
    fireEvent.click(screen.getByRole("button", { name: /save my birthday/i }));
    await waitFor(() =>
      expect(fns.saveMyBirthDate).toHaveBeenCalledWith({ data: { year: 1990, month: 4 } }),
    );
    await waitFor(() => expect(fns.getAdultStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("When were you born?")).toBeNull());
  });

  it("doesn't ask when the birthday is already saved", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    expect(screen.queryByText("When were you born?")).toBeNull();
  });

  it("never asks inside the Android/iOS app", async () => {
    setUA(`${WEB_UA} WhyNativeApp`);
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: false,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    expect(screen.queryByText("When were you born?")).toBeNull();
    expect(fns.getAdultStatus).not.toHaveBeenCalled();
  });

  it("'Not now' hides it for this visit", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: false,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: /not now/i }));
    await waitFor(() => expect(screen.queryByText("When were you born?")).toBeNull());
    expect(sessionStorage.getItem("why:birthday-prompt-snoozed")).toBe("1");
  });
});
