// Only same-site paths are allowed as a post-sign-in destination. Anything
// else ("https://…", "//evil.com", "/\evil.com", "javascript:…") falls back
// to "/" so a crafted ?redirect= link can't send players to another site.
export function safeRedirect(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  if (value.startsWith("//") || value.startsWith("/\\")) return "/";
  // Browsers drop tabs/newlines and treat "\" like "/" in URLs, so
  // "/\t/evil.com" would become "//evil.com". Refuse control characters.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return "/";
  return value;
}
