import { describe, expect, it } from "vitest";
import { safeRedirect } from "./safeRedirect";

describe("safeRedirect", () => {
  it("keeps same-site paths", () => {
    expect(safeRedirect("/")).toBe("/");
    expect(safeRedirect("/profile")).toBe("/profile");
    expect(safeRedirect("/import-guest?redirect=%2Fsettings#top")).toBe(
      "/import-guest?redirect=%2Fsettings#top",
    );
  });

  it("falls back to / for anything off-site or odd", () => {
    for (const bad of [
      undefined,
      null,
      "",
      "profile",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      " /profile",
    ]) {
      expect(safeRedirect(bad)).toBe("/");
    }
  });
});
