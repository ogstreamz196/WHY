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
  useSignOut: () => vi.fn(async () => {}),
}));
vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: unknown) => unknown }) =>
    select({ location: { pathname: "/" } }),
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
// Plain elements instead of animations: happy-dom cancels exit animations
// with unhandled errors.
vi.mock("framer-motion", () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: {
    form: ({
      initial: _i,
      animate: _a,
      exit: _e,
      ...rest
    }: React.FormHTMLAttributes<HTMLFormElement> & Record<string, unknown>) => <form {...rest} />,
  },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import { BirthdayCard } from "../components/BirthdayCard";
import { UnderAgeNotice } from "../components/UnderAgeNotice";

const WEB_UA = navigator.userAgent;
const setUA = (ua: string) =>
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });

function renderPrompt() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BirthdayCard userId="u1" />
      <UnderAgeNotice />
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
  localStorage.clear();
  fns.getAdultStatus.mockReset();
  fns.saveMyBirthDate.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  setUA(WEB_UA);
});

describe("BirthdayCard", () => {
  it("asks website users without a saved birthday, neutrally", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: false,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    expect(await screen.findByText("Add your birthday")).toBeTruthy();
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
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    await waitFor(() =>
      expect(fns.saveMyBirthDate).toHaveBeenCalledWith({ data: { year: 1990, month: 4 } }),
    );
    await waitFor(() => expect(fns.getAdultStatus).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(screen.queryByText("Add your birthday")).toBeNull());
  });

  it("doesn't ask when the birthday is already saved", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    expect(screen.queryByText("Add your birthday")).toBeNull();
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
    expect(screen.queryByText("Add your birthday")).toBeNull();
    expect(fns.getAdultStatus).not.toHaveBeenCalled();
  });

  it("saves the birthday picked on the sign-up page after Google/Apple, without asking", async () => {
    localStorage.setItem(
      "why:pending-birth",
      JSON.stringify({ year: 1988, month: 7, at: Date.now() }),
    );
    fns.getAdultStatus
      .mockResolvedValueOnce({ birthdate_known: false, available: false, mode_enabled: false })
      .mockResolvedValue({ birthdate_known: true, available: true, mode_enabled: false });
    fns.saveMyBirthDate.mockResolvedValue({ ok: true });
    renderPrompt();
    await waitFor(() =>
      expect(fns.saveMyBirthDate).toHaveBeenCalledWith({ data: { year: 1988, month: 7 } }),
    );
    await settle();
    expect(screen.queryByText("Add your birthday")).toBeNull();
    expect(localStorage.getItem("why:pending-birth")).toBeNull();
  });

  it("covers the site for accounts whose birthday is under 13", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: false,
      mode_enabled: false,
      under_13: true,
    });
    renderPrompt();
    expect(await screen.findByText(/ages 13 and up/i)).toBeTruthy();
    expect(screen.queryByText("Add your birthday")).toBeNull();
  });

  it("'Later' hides it for this visit", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: false,
      available: false,
      mode_enabled: false,
    });
    renderPrompt();
    await settle();
    fireEvent.click(await screen.findByRole("button", { name: /later/i }));
    await waitFor(() => expect(screen.queryByText("Add your birthday")).toBeNull());
    expect(sessionStorage.getItem("why:birthday-card-snoozed")).toBe("1");
  });
});
