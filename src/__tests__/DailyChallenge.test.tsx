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

function renderSignedIn(recordWin: () => Promise<unknown>, doneToday: boolean | null = false) {
  const qc = new QueryClient();
  const onCompleted = vi.fn();
  render(
    <QueryClientProvider client={qc}>
      <DailyChallenge
        userId="u1"
        doneToday={doneToday}
        onCompleted={onCompleted}
        recordWin={recordWin as never}
      />
    </QueryClientProvider>,
  );
  return onCompleted;
}

async function answerCorrectly() {
  await screen.findByText(/scatters off air molecules/);
  await act(async () => {
    await vi.advanceTimersByTimeAsync(16_000);
  });
  fireEvent.click(screen.getByRole("button", { name: /quiz me/i }));
  fireEvent.click(screen.getByRole("radio", { name: /Option B/ }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(100);
  });
}

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

  it("signed in: the server records the win, not this device", async () => {
    const recordWin = vi.fn(async () => ({
      awarded: true,
      streak: 4,
      pointsDelta: 25,
      reward: { kind: "coins", amount: 10 },
    }));
    const onCompleted = renderSignedIn(recordWin);
    await answerCorrectly();
    expect(recordWin).toHaveBeenCalledTimes(1);
    expect(onCompleted).not.toHaveBeenCalled();
    expect(localStorage.getItem("why:points")).toBeNull();
    expect((await screen.findAllByText(/4-day streak/)).length).toBeGreaterThan(0);
  });

  it("signed in: shows no coins when the account already won today", async () => {
    const recordWin = vi.fn(async () => ({ awarded: false, streak: 4, pointsDelta: 0 }));
    renderSignedIn(recordWin);
    await answerCorrectly();
    expect(recordWin).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/\+25 coins/)).toBeNull();
  });

  it("signed in: a guest's win on this device doesn't lock the account out", async () => {
    // A sibling played as a guest on this device today.
    const d = new Date();
    localStorage.setItem(
      "why:dailyDone",
      JSON.stringify(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`),
    );
    renderSignedIn(
      vi.fn(async () => null),
      false,
    );
    await screen.findByText(/scatters off air molecules/);
    expect(screen.queryByText(/streak locked in/i)).toBeNull();
  });

  it("signed in: follows the account when today's challenge is already done", async () => {
    renderSignedIn(
      vi.fn(async () => null),
      true,
    );
    expect(await screen.findByText(/streak locked in/i)).toBeTruthy();
  });
});
