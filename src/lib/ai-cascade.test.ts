import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateWithCascade } from "./ai-cascade.server";

const ok = (text: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content: text } }] }), { status: 200 });

describe("AI provider cascade", () => {
  beforeEach(() => {
    process.env.GROQ_API_KEY = "g";
    process.env.OPENROUTER_API_KEY = "o";
    process.env.POLLINATIONS_API_KEY = "p";
    process.env.LOVABLE_API_KEY = "l";
  });
  afterEach(() => vi.unstubAllGlobals());

  it("uses Groq first", async () => {
    const f = vi.fn(async (url: string) => ok(url.includes("groq") ? "groq" : "other"));
    vi.stubGlobal("fetch", f);
    expect(await generateWithCascade("x")).toBe("groq");
  });

  it("falls back to OpenRouter when Groq fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("groq") ? new Response("busy", { status: 429 }) : ok("openrouter"),
      ),
    );
    expect(await generateWithCascade("x")).toBe("openrouter");
  });

  it("falls back to Pollinations when Groq and OpenRouter fail", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("pollinations") ? ok("pollinations") : new Response("busy", { status: 429 }),
      ),
    );
    expect(await generateWithCascade("x")).toBe("pollinations");
  });

  it("sends a second simultaneous request to Pollinations first", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const calls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        calls.push(url);
        if (url.includes("groq")) await gate;
        return ok(url.includes("pollinations") ? "pollinations" : "groq");
      }),
    );
    const first = generateWithCascade("a");
    const second = await generateWithCascade("b");
    release();
    expect(second).toBe("pollinations");
    expect(await first).toBe("groq");
  });
});
