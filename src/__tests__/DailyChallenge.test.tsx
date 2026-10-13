import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const MCQ = {
  fact: {
    id: "f1",
    question: "the sky is blue",
    answer: "Sunlight scatters off air molecules, and blue light scatters the most.",
    fun_fact: "Sunsets look red for the same reason.",
    category: "space",
  },
  choices: ["Because of the sea", "Blue light scatters the most", "Paint", "Magic"],
  correctIndex: 1,
};

vi.mock("@tanstack/react-start", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-start")>()),
  useServerFn: () => async () => MCQ,
}));

import { DailyChallenge } from "../components/DailyChallenge";
import { readingTimeMs } from "../lib/readingTime";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers({ shouldAdvanceTime: true });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function renderChallenge(onCompleted = vi.fn()) {
  const qc = new QueryClient();
  render(
    <QueryClientProvider client={qc}>
      <DailyChallenge onCompleted={onCompleted} />
    </QueryClientProvider>,
  );
  return onCompleted;
}

describe("readingTimeMs", () => {
  it("gives at least 5 and at most 15 seconds", () => {
    expect(readingTimeMs("short")).toBe(5000);
    expect(readingTimeMs("word ".repeat(30))).toBe(10000);
    expect(readingTimeMs("word ".repeat(500))).toBe(15000);
  });
});

describe("DailyChallenge", () => {
  it("shows the whole fact and waits before the question unlocks", async () => {
    renderChallenge();
    await screen.findByText(/scatters off air molecules/);
    const btn = screen.getByRole("button", { name: /take your time reading/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    expect(screen.getByRole("button", { name: /quiz me/i })).toBeTruthy();
  });

  it("asks a multiple-choice question and offers a mystery reward", async () => {
    const onCompleted = renderChallenge(
      vi.fn(async () => ({ kind: "coins", amount: 15 }) as const),
    );
    await screen.findByText(/scatters off air molecules/);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(16_000);
    });
    fireEvent.click(screen.getByRole("button", { name: /quiz me/i }));
    expect(screen.getAllByRole("radio")).toHaveLength(4);

    fireEvent.click(screen.getByRole("radio", { name: /Option A/ }));
    expect(screen.getByText(/not quite/i)).toBeTruthy();
    expect(onCompleted).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.click(screen.getByRole("radio", { name: /Option B/ }));
    expect(onCompleted).toHaveBeenCalledTimes(1);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(100);
    });

    fireEvent.click(await screen.findByRole("button", { name: /open your mystery reward/i }));
    fireEvent.click(await screen.findByRole("button", { name: /open your reward/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });
    expect(await screen.findByText(/\+15 bonus coins/)).toBeTruthy();
  });
});
