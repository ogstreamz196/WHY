// Username + password accounts. The auth system needs an email per account, so
// each username gets a private placeholder address that never receives mail.
// Players can later attach a real recovery email (replaces the placeholder).
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const PLACEHOLDER_DOMAIN = "account.why.ogbot.co.uk";
const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username needs at least 3 characters")
  .max(20, "Username can be at most 20 characters")
  .regex(/^[A-Za-z0-9_.-]+$/, "Use letters, numbers, dots, dashes or underscores only");
const passwordSchema = z.string().min(8, "Password needs at least 8 characters").max(72);

function placeholderEmail(username: string) {
  return `${username.trim().toLowerCase()}@${PLACEHOLDER_DOMAIN}`;
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

function freshClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient(url, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

async function signInByEmail(email: string, password: string) {
  const { data, error } = await freshClient().auth.signInWithPassword({ email, password });
  if (error || !data.session) return { error: "Wrong username or password." } as const;
  return {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  } as const;
}

function ageFrom(year: number, month: number) {
  const now = new Date();
  let age = now.getFullYear() - year;
  if (now.getMonth() + 1 < month) age -= 1;
  return age;
}

export const signUpWithUsername = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        username: usernameSchema,
        password: passwordSchema,
        birthYear: z.number().int(),
        birthMonth: z.number().int().min(1).max(12),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    if (ageFrom(data.birthYear, data.birthMonth) < 13) {
      return { error: "Accounts are for explorers aged 13 and up." } as const;
    }
    const db = await admin();
    const { data: taken } = await db
      .from("profiles")
      .select("id")
      .ilike("username", data.username.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();
    if (taken) return { error: "That username is taken — try another." } as const;

    const email = placeholderEmail(data.username);
    const { error } = await db.auth.admin.createUser({
      email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.username, username: data.username },
    });
    if (error) {
      console.error("[signUpWithUsername]", error.message);
      const msg = /already/i.test(error.message)
        ? "That username is taken — try another."
        : "Couldn't create the account. Please try again.";
      return { error: msg } as const;
    }
    return signInByEmail(email, data.password);
  });

export const signInWithUsername = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z.object({ username: z.string().trim().min(1).max(40), password: z.string().min(1).max(72) }).parse(d),
  )
  .handler(async ({ data }) => {
    const db = await admin();
    const { data: profile } = await db
      .from("profiles")
      .select("id")
      .ilike("username", data.username.replace(/[\\%_]/g, "\\$&"))
      .maybeSingle();
    let email = placeholderEmail(data.username);
    if (profile) {
      const { data: u } = await db.auth.admin.getUserById(profile.id);
      if (u.user?.email) email = u.user.email;
    }
    return signInByEmail(email, data.password);
  });

export const setRecoveryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ email: z.string().trim().email().max(254) }).parse(d))
  .handler(async ({ data, context }) => {
    const db = await admin();
    const { error } = await db.auth.admin.updateUserById(context.userId, {
      email: data.email.toLowerCase(),
      email_confirm: true,
    });
    if (error) {
      return {
        error: /already/i.test(error.message)
          ? "That email is already used by another account."
          : "Couldn't save the email. Please try again.",
      } as const;
    }
    return { ok: true } as const;
  });
