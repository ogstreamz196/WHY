import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import type { ReactNode } from "react";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, params }: { children: ReactNode; params?: { slug: string } }) => (
    <a href={`/fact/${params?.slug ?? ""}`}>{children}</a>
  ),
}));

import { MissedFacts } from "@/components/MissedFacts";

afterEach(cleanup);

describe("MissedFacts", () => {
  it("shows nothing after a perfect quiz", () => {
    const { container } = render(<MissedFacts missed={[]} />);
    expect(container.textContent).toBe("");
  });

  it("links each missed fact to its page, as a question", () => {
    render(
      <MissedFacts
        missed={[
          { question: "we have leap years", code: "WHY-ABC123" },
          { question: "the sky is blue", code: null },
        ]}
      />,
    );
    expect(screen.getByText("Read the facts you missed")).toBeTruthy();
    const link = screen.getByText("Why do we have leap years?").closest("a");
    expect(link?.getAttribute("href")).toContain("why-abc123");
    // No code: still listed, just not a link.
    expect(screen.getByText("Why is the sky blue?").closest("a")).toBeNull();
  });
});
