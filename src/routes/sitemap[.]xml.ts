import { createFileRoute } from "@tanstack/react-router";
import { SITE_URL, factPath } from "@/lib/site";

// sitemap.xml, built from the fact library so every fact page can be found.
// Only public pages; private ones (settings, profile, 18+) are left out and
// marked noindex. Cached for an hour.

const STATIC_PAGES: Array<{ path: string; priority: string; changefreq: string }> = [
  { path: "/", priority: "1.0", changefreq: "daily" },
  { path: "/leaderboard", priority: "0.6", changefreq: "daily" },
  { path: "/store", priority: "0.5", changefreq: "weekly" },
  { path: "/privacy", priority: "0.2", changefreq: "monthly" },
  { path: "/delete-account", priority: "0.1", changefreq: "yearly" },
];

const MAX_FACTS = 45_000; // sitemaps hold up to 50,000 addresses
const PAGE = 1000;
const TTL_MS = 60 * 60 * 1000;
let cache: { xml: string; at: number } | null = null;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function factEntries(): Promise<string[]> {
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const out: string[] = [];
  for (let from = 0; from < MAX_FACTS; from += PAGE) {
    const { data, error } = await db
      .from("facts")
      .select("code, question, created_at")
      .not("code", "is", null)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    for (const f of data) {
      if (!f.code || !f.question) continue;
      const lastmod = f.created_at ? `<lastmod>${f.created_at.slice(0, 10)}</lastmod>` : "";
      out.push(
        `<url><loc>${esc(SITE_URL + factPath(f.question, f.code))}</loc>${lastmod}<changefreq>monthly</changefreq><priority>0.7</priority></url>`,
      );
    }
    if (data.length < PAGE) break;
  }
  return out;
}

async function buildSitemap(): Promise<string> {
  const pages = STATIC_PAGES.map(
    (p) =>
      `<url><loc>${SITE_URL}${p.path}</loc><changefreq>${p.changefreq}</changefreq><priority>${p.priority}</priority></url>`,
  );
  const facts = await factEntries().catch((e) => {
    console.warn("[sitemap] facts unavailable", e);
    return [] as string[];
  });
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${[...pages, ...facts].join("\n")}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        if (!cache || Date.now() - cache.at > TTL_MS) {
          cache = { xml: await buildSitemap(), at: Date.now() };
        }
        return new Response(cache.xml, {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
