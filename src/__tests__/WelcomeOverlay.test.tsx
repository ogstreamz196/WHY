import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";
import { WelcomeOverlay } from "./index";

afterEach(cleanup);

describe("WelcomeOverlay onboarding button", () => {
  it("shows 'Begin the journey' for new users (needsName=true)", () => {
    render(
      <WelcomeOverlay
        open
        name={null}
        needsName
        onClose={() => {}}
        onSubmitName={async () => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /begin the journey/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /continue the journey/i })).toBeNull();
    // nickname input is present for new users
    expect(screen.getByLabelText(/your nickname/i)).toBeTruthy();
  });

  it("shows 'Continue the journey' for returning users (needsName=false)", () => {
    render(
      <WelcomeOverlay open name="Ada" needsName={false} onClose={() => {}} />,
    );
    expect(screen.getByRole("button", { name: /continue the journey/i })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /begin the journey/i })).toBeNull();
    // no nickname input for returning users
    expect(screen.queryByLabelText(/your nickname/i)).toBeNull();
  });

  it("routing: returning user click calls onClose without saving a nickname", () => {
    const onClose = vi.fn();
    const onSubmitName = vi.fn();
    render(
      <WelcomeOverlay
        open
        name="Ada"
        needsName={false}
        onClose={onClose}
        onSubmitName={onSubmitName}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continue the journey/i }));
    expect(onSubmitName).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("routing: new user click saves nickname then closes", async () => {
    const onClose = vi.fn();
    const onSubmitName = vi.fn().mockResolvedValue(undefined);
    render(
      <WelcomeOverlay
        open
        name={null}
        needsName
        onClose={onClose}
        onSubmitName={onSubmitName}
      />,
    );
    const input = screen.getByLabelText(/your nickname/i) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "  Curious Cat  " } });
    fireEvent.click(screen.getByRole("button", { name: /begin the journey/i }));
    await waitFor(() => expect(onSubmitName).toHaveBeenCalledWith("Curious Cat"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("routing: new user with empty nickname does NOT save or close", async () => {
    const onClose = vi.fn();
    const onSubmitName = vi.fn();
    render(
      <WelcomeOverlay
        open
        name={null}
        needsName
        onClose={onClose}
        onSubmitName={onSubmitName}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /begin the journey/i }));
    await waitFor(() =>
      expect(screen.getByText(/nickname must be 1[–-]60 characters/i)).toBeTruthy(),
    );
    expect(onSubmitName).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
