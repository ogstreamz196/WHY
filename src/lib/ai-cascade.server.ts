// Text generation cascade for facts.
// Order: Groq -> OpenRouter -> Pollinations -> Lovable AI (last resort).
// When another request is already in flight on this server, Pollinations
// takes the new request first so the primary keys aren't hammered.

type Provider = {
  name: string;
  url: string;
  model: string;
  key: string | undefined;
  extraHeaders?: Record<string, string>;
};

let inFlight = 0;

function providers(lovableKey?: string): Provider[] {
  return [
    {
      name: "groq",
      url: "https://api.groq.com/openai/v1/chat/completions",
      model: "llama-3.3-70b-versatile",
      key: process.env.GROQ_API_KEY,
    },
    {
      name: "openrouter",
      url: "https://openrouter.ai/api/v1/chat/completions",
      model: "meta-llama/llama-3.3-70b-instruct",
      key: process.env.OPENROUTER_API_KEY,
      extraHeaders: { "HTTP-Referer": "https://why.ogbot.co.uk", "X-Title": "WHY?" },
    },
    {
      name: "pollinations",
      url: "https://text.pollinations.ai/openai",
      model: "openai",
      key: process.env.POLLINATIONS_API_KEY,
    },
    {
      name: "lovable",
      url: "https://ai.gateway.lovable.dev/v1/chat/completions",
      model: "google/gemini-2.5-flash",
      key: lovableKey ?? process.env.LOVABLE_API_KEY,
    },
  ];
}

async function callOne(p: Provider, prompt: string): Promise<string> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${p.key}`,
      ...(p.extraHeaders ?? {}),
    };
    if (p.name === "lovable") headers["Lovable-API-Key"] = p.key!;
    const res = await fetch(p.url, {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: p.model,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.8,
      }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`${p.name} [${res.status}]: ${body.slice(0, 300)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const text = json.choices?.[0]?.message?.content;
    if (!text) throw new Error(`${p.name}: empty response`);
    return text;
  } finally {
    clearTimeout(timer);
  }
}

/** Generate text, trying each configured provider in turn. */
export async function generateWithCascade(prompt: string, lovableKey?: string): Promise<string> {
  const busy = inFlight > 0;
  inFlight++;
  try {
    let list = providers(lovableKey).filter((p) => !!p.key);
    if (busy) {
      const poll = list.find((p) => p.name === "pollinations");
      if (poll) list = [poll, ...list.filter((p) => p !== poll)];
    }
    let lastErr: unknown = null;
    for (const p of list) {
      try {
        return await callOne(p, prompt);
      } catch (err) {
        console.warn("[ai-cascade]", err instanceof Error ? err.message : err);
        lastErr = err;
      }
    }
    throw lastErr ?? new Error("No AI provider configured");
  } finally {
    inFlight--;
  }
}
