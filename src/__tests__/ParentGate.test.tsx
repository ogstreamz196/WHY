import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { ParentGate } from "../components/ParentGate";

afterEach(cleanup);

function question() {
  const m = screen.getByText(/What is \d+ × \d+\?/).textContent!.match(/(\d+) × (\d+)/)!;
  return { a: Number(m[1]), b: Number(m[2]) };
}

describe("ParentGate", () => {
  it("passes only with the right answer", () => {
    const onPass = vi.fn();
    render(<ParentGate open onPass={onPass} onClose={() => {}} />);
    const { a, b } = question();
    fireEvent.change(screen.getByLabelText("Answer"), { target: { value: String(a * b + 1) } });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPass).not.toHaveBeenCalled();
    expect(screen.getByText(/here's a new one/i)).toBeTruthy();

    const next = question();
    fireEvent.change(screen.getByLabelText("Answer"), {
      target: { value: String(next.a * next.b) },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onPass).toHaveBeenCalledTimes(1);
  });

  it("asks questions a young child can't easily guess", () => {
    render(<ParentGate open onPass={() => {}} onClose={() => {}} />);
    const { a, b } = question();
    expect(a).toBeGreaterThanOrEqual(6);
    expect(b).toBeGreaterThanOrEqual(6);
  });

  it("can be cancelled", () => {
    const onClose = vi.fn();
    render(<ParentGate open onPass={() => {}} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalled();
  });
});
