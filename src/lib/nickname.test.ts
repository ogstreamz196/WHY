import { beforeEach, describe, expect, it } from "vitest";
import { confirmNickname, needsNickname } from "./nickname";

beforeEach(() => localStorage.clear());

describe("needsNickname", () => {
  it("never asks username accounts again", () => {
    expect(needsNickname("maya_99", "maya_99@account.why.ogbot.co.uk", "u1")).toBe(false);
    expect(needsNickname("Maya", "maya@account.why.ogbot.co.uk", "u1")).toBe(false);
  });

  it("asks when there's no name at all", () => {
    expect(needsNickname("", "maya@account.why.ogbot.co.uk", "u1")).toBe(true);
    expect(needsNickname(null, "maya@gmail.com", "u1")).toBe(true);
  });

  it("asks Google/Apple accounts still using their email name, once", () => {
    expect(needsNickname("maya.smith", "maya.smith@gmail.com", "u2")).toBe(true);
    confirmNickname("u2");
    expect(needsNickname("maya.smith", "maya.smith@gmail.com", "u2")).toBe(false);
  });

  it("doesn't ask when a real nickname is set", () => {
    expect(needsNickname("Captain Curious", "maya.smith@gmail.com", "u3")).toBe(false);
  });
});
