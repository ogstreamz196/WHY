import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import type { ReactNode } from "react";

const fns = vi.hoisted(() => ({
  getAdultStatus: vi.fn(),
  setAdultMode: vi.fn(),
  saveMyBirthDate: vi.fn(),
  nextAdultFact: vi.fn(),
  adultWhyLayer: vi.fn(),
  askOg: vi.fn(),
}));

vi.mock("@/lib/adult.functions", () => fns);
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({
  useCurrentUser: () => ({ user: { id: "u1", email: "a@b.c" }, loading: false, isGuest: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { Route } from "../routes/adult";

const WEB_UA = navigator.userAgent;
function setUA(ua: string) {
  Object.defineProperty(navigator, "userAgent", { value: ua, configurable: true });
}

function renderPage() {
  const Page = (Route as unknown as { component: () => React.ReactElement }).component;
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Page />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(fns).forEach((f) => f.mockReset());
  fns.nextAdultFact.mockResolvedValue({
    id: "11111111-1111-1111-1111-111111111111",
    question: "your farts smell worse when you eat eggs",
    answer: "Eggs are packed with sulphur, you stinky legend.",
    fun_fact: "Rotten-egg gas is the same stuff.",
    category: "gross body",
  });
});
afterEach(() => {
  cleanup();
  setUA(WEB_UA);
});

describe("18+ page", () => {
  it("shows nothing adult inside the Android/iOS app", async () => {
    setUA(`${WEB_UA} WhyNativeApp`);
    renderPage();
    expect(await screen.findByText(/page not found/i)).toBeTruthy();
    expect(fns.getAdultStatus).not.toHaveBeenCalled();
    expect(fns.nextAdultFact).not.toHaveBeenCalled();
    expect(screen.queryByText(/18\+/)).toBeNull();
  });

  it("turns away accounts that aren't 18+", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: false,
      mode_enabled: false,
    });
    renderPage();
    expect(await screen.findByText(/isn't available for your account/i)).toBeTruthy();
    expect(fns.nextAdultFact).not.toHaveBeenCalled();
  });

  it("asks adults to flip the switch before showing anything", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: true,
      mode_enabled: false,
    });
    renderPage();
    expect(await screen.findByText(/after dark/i)).toBeTruthy();
    expect(fns.nextAdultFact).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("switch", { name: "18+ mode" }));
    expect(await screen.findByText(/adults only past this point/i)).toBeTruthy();
  });

  it("shows facts, But… why? and Ask Why? in 18+ mode", async () => {
    fns.getAdultStatus.mockResolvedValue({
      birthdate_known: true,
      available: true,
      mode_enabled: true,
    });
    fns.adultWhyLayer.mockResolvedValue({ answer: "Because your gut bacteria are tiny chemists." });
    fns.askOg.mockResolvedValue({ reply: "Because you're gross, mate.", from: "og" });
    renderPage();

    expect(await screen.findByText(/when you eat eggs/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /tell me/i }));
    expect(screen.getByText(/packed with sulphur/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /but… why\?/i }));
    expect(await screen.findByText(/tiny chemists/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/your question for og/i), {
      target: { value: "Why is earwax a thing?" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(await screen.findByText(/gross, mate/)).toBeTruthy();
    await waitFor(() =>
      expect(fns.askOg).toHaveBeenCalledWith({
        data: { question: "Why is earwax a thing?", history: [] },
      }),
    );
  });
});
