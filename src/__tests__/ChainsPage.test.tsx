import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import type { ReactNode } from "react";

const chainsFns = vi.hoisted(() => ({
  listMyChains: vi.fn(),
  deleteChain: vi.fn(),
  setChainShared: vi.fn(),
  togglePinChain: vi.fn(),
}));
const accountFns = vi.hoisted(() => ({
  listFavorites: vi.fn(),
  toggleFavorite: vi.fn(),
}));

vi.mock("@/components/BottomNav", () => ({ BottomNav: () => null }));
vi.mock("@/components/CosmicBackground", () => ({ CosmicBackground: () => null }));
vi.mock("@/lib/chains.functions", () => chainsFns);
vi.mock("@/lib/account.functions", () => accountFns);
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/auth", () => ({
  useCurrentUser: () => ({ user: { id: "u1" }, loading: false, isGuest: false }),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: Record<string, unknown>) => opts,
  Link: ({ children }: { children: ReactNode }) => <a href="#">{children}</a>,
  useNavigate: () => vi.fn(),
}));

import { Route } from "../routes/chains";

function renderPage() {
  const Page = (Route as unknown as { component: () => React.ReactElement }).component;
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <Page />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  Object.values(chainsFns).forEach((f) => f.mockReset());
  Object.values(accountFns).forEach((f) => f.mockReset());
  accountFns.listFavorites.mockResolvedValue([
    {
      id: "f1",
      question: "we have leap years",
      answer: "Earth's year is 365¼ days.",
      fun_fact: null,
      category: "space",
    },
  ]);
  chainsFns.listMyChains.mockResolvedValue({
    items: [
      {
        id: "c1",
        title: "the sky is blue",
        last_question: "But why does light scatter?",
        step_count: 3,
        pinned: false,
        is_public: false,
        share_slug: null,
      },
    ],
  });
  chainsFns.deleteChain.mockResolvedValue({ ok: true });
});
afterEach(cleanup);

describe("Favourites page", () => {
  it("shows hearted facts as questions, with counts on the tabs", async () => {
    renderPage();
    expect(await screen.findByText("Why do we have leap years?")).toBeTruthy();
    await waitFor(() => expect(screen.getByRole("tab", { name: "Trails (1)" })).toBeTruthy());
    expect(screen.getByRole("tab", { name: "Facts (1)" }).getAttribute("aria-selected")).toBe(
      "true",
    );
  });

  it("asks in the page before deleting a trail", async () => {
    renderPage();
    fireEvent.click(await screen.findByRole("tab", { name: /Trails/ }));
    expect(await screen.findByText("Why is the sky blue?")).toBeTruthy();
    expect(screen.getByRole("switch", { name: /Public link: off/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Delete trail" }));
    expect(chainsFns.deleteChain).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete trail" }));
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    await waitFor(() => expect(chainsFns.deleteChain).toHaveBeenCalledWith({ data: { id: "c1" } }));
  });
});
