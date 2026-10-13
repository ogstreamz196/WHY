// Site-wide SEO settings and helpers. One place for the public address, the
// default wording and the share image, so every page describes itself the
// same way to Google and to social apps.

/** The public address of the website (also used in the sitemap and robots.txt). */
export const SITE_URL = "https://why.ogbot.co.uk";
export const SITE_NAME = "Why?";
export const SITE_TAGLINE = "Fun facts for curious kids";
export const DEFAULT_TITLE = "Why? — Fun Facts & Big Questions for Curious Kids";
export const DEFAULT_DESCRIPTION =
  "Why is the sky blue? Why do cats purr? Why? turns every question into a fun, true, kid-friendly fact — with quizzes, daily challenges and “But why?” deep dives the whole family can enjoy.";
export const OG_IMAGE = `${SITE_URL}/og-image.png`;
export const LOGO_URL = `${SITE_URL}/icon-512.png`;

type Meta = Record<string, string>;
type LinkTag = Record<string, string>;

/**
 * Title, description, canonical link and social cards for one page.
 * `path` is the page's own path, e.g. "/leaderboard".
 */
export function seo({
  title,
  description = DEFAULT_DESCRIPTION,
  path = "/",
  image = OG_IMAGE,
  type = "website",
  noindex = false,
  themeColor,
}: {
  title: string;
  description?: string;
  path?: string;
  image?: string;
  type?: "website" | "article";
  noindex?: boolean;
  /** Browser bar colour for this page. */
  themeColor?: string;
}): { meta: Meta[]; links: LinkTag[] } {
  const url = `${SITE_URL}${path}`;
  const desc = description.length > 160 ? `${description.slice(0, 157).trimEnd()}…` : description;
  const meta: Meta[] = [
    { title },
    { name: "description", content: desc },
    { property: "og:title", content: title },
    { property: "og:description", content: desc },
    { property: "og:type", content: type },
    { property: "og:url", content: url },
    { property: "og:image", content: image },
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:alt", content: `${SITE_NAME}: ${SITE_TAGLINE}` },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: desc },
    { name: "twitter:image", content: image },
  ];
  if (noindex) meta.push({ name: "robots", content: "noindex, nofollow" });
  if (themeColor) meta.push({ name: "theme-color", content: themeColor });
  return { meta, links: noindex ? [] : [{ rel: "canonical", href: url }] };
}

/** Lower-case, dash-separated words for a URL, at most ~70 characters. */
export function slugify(text: string): string {
  let s = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  // Cut long slugs at a whole word.
  if (s.length > 70) s = s.slice(0, 70).replace(/-[^-]*$/, "");
  return s;
}

/** "Why is the sky blue?" + "WHY-1A2B3C" → "why-is-the-sky-blue-why-1a2b3c". */
export function factSlug(question: string, code: string): string {
  const words = slugify(question.replace(/^(do you know )?why\s+/i, ""));
  return `why-${words ? `${words}-` : ""}${code.toLowerCase()}`;
}

/** The fact code at the end of a fact slug, e.g. "WHY-1A2B3C", or null. */
export function codeFromFactSlug(slug: string): string | null {
  const m = slug.toLowerCase().match(/(?:^|-)why-([0-9a-f]{6})$/);
  return m ? `WHY-${m[1].toUpperCase()}` : null;
}

export function factPath(question: string, code: string): string {
  return `/fact/${factSlug(question, code)}`;
}
