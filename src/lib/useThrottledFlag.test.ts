import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useThrottledFlag } from "./useThrottledFlag";

describe("useThrottledFlag (skeleton throttle)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not show skeleton before the throttle window elapses (fast load)", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useThrottledFlag(active, 180),
      { initialProps: { active: true } },
    );

    // Before the delay: hidden.
    expect(result.current).toBe(false);

    // Fast load finishes at 100ms — well under the 180ms threshold.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    // Loading flips false before threshold: skeleton must never appear.
    rerender({ active: false });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    expect(result.current).toBe(false);
  });

  it("shows skeleton once the throttle window elapses (slow load)", () => {
    const { result } = renderHook(() => useThrottledFlag(true, 180));

    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(180);
    });
    expect(result.current).toBe(true);
  });

  it("hides skeleton immediately when loading ends after showing", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useThrottledFlag(active, 180),
      { initialProps: { active: true } },
    );
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe(true);

    // Data loaded → active becomes false. Skeleton disappears synchronously.
    rerender({ active: false });
    expect(result.current).toBe(false);
  });

  it("handles a skip cycle: hides on new load then re-shows only after threshold", () => {
    const { result, rerender } = renderHook(
      ({ active }) => useThrottledFlag(active, 180),
      { initialProps: { active: true } },
    );
    // First load completes fast (no skeleton flash).
    act(() => {
      vi.advanceTimersByTime(50);
    });
    rerender({ active: false });
    expect(result.current).toBe(false);

    // User skips → loading starts again.
    rerender({ active: true });
    expect(result.current).toBe(false);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(false);

    // Skip fetch is slow — passes threshold.
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(result.current).toBe(true);

    // Skip resolves — skeleton hides again.
    rerender({ active: false });
    expect(result.current).toBe(false);
  });
});
