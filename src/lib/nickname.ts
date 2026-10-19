// When to ask a signed-in player for a nickname (the welcome overlay).
//
// Username accounts chose their name at sign-up, so they're never asked:
// their behind-the-scenes email is "<username>@account.why.ogbot.co.uk", and
// the old check ("name equals the start of the email") matched every time,
// so they were asked again and again. Google/Apple accounts start with their
// email's first part as their name and are asked once; whatever they choose
// (even that same name) is remembered on this device.
import { PLACEHOLDER_DOMAIN as ACCOUNT_EMAIL_DOMAIN } from "@/lib/username-auth.functions";

const confirmedKey = (userId: string) => `why:nickname-confirmed:${userId}`;

export function needsNickname(
  name: string | null | undefined,
  email: string | null | undefined,
  userId?: string | null,
): boolean {
  const n = (name ?? "").trim();
  if (!n) return true;
  const e = (email ?? "").trim().toLowerCase();
  if (e.endsWith(`@${ACCOUNT_EMAIL_DOMAIN}`)) return false;
  if (userId && isNicknameConfirmed(userId)) return false;
  const prefix = e.split("@")[0] ?? "";
  return n.toLowerCase() === prefix;
}

export function isNicknameConfirmed(userId: string): boolean {
  try {
    return localStorage.getItem(confirmedKey(userId)) === "1";
  } catch {
    return false;
  }
}

export function confirmNickname(userId: string): void {
  try {
    localStorage.setItem(confirmedKey(userId), "1");
  } catch {
    /* private mode: they may be asked once more next time */
  }
}
