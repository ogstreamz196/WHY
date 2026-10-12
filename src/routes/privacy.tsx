import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { CosmicBackground } from "@/components/CosmicBackground";
import { CONTACT_EMAIL, PRIVACY_POLICY_UPDATED } from "@/lib/legal";

// Plain-language privacy policy written from what the code actually stores
// and shares. Have it reviewed before relying on it legally, and update it
// whenever data handling changes.
export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy policy — Why?" },
      { name: "description", content: "What Why? collects, why, and how to delete it." },
      { property: "og:title", content: "Privacy policy — Why?" },
      { property: "og:description", content: "What Why? collects, why, and how to delete it." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PrivacyPage,
});

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="font-display text-lg font-black text-white">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-white/80">{children}</div>
    </section>
  );
}

function PrivacyPage() {
  return (
    <main className="relative min-h-[100dvh] px-4 py-10">
      <CosmicBackground />
      <article className="glass-strong mx-auto w-full max-w-2xl rounded-4xl border border-white/10 p-6 text-white">
        <Link to="/" className="text-xs font-bold text-white/60 underline">
          ← Back to Why?
        </Link>
        <h1 className="mt-3 font-display text-3xl font-black">Privacy policy</h1>
        <p className="mt-1 text-xs text-white/50">Last updated {PRIVACY_POLICY_UPDATED}</p>

        <Section title="The short version">
          <p>
            Why? shows fun "do you know why…" facts. You can use it as a guest without giving us
            anything. If you create an account, we keep what's needed to save your progress. We
            don't show ads, we don't use tracking or advertising tools, and we never sell your data.
          </p>
        </Section>

        <Section title="If you use Why? as a guest">
          <p>
            Your coins, streak and favourites are kept only in this browser or app session and
            disappear when you close it. We don't ask for your name or email. If you type a question
            into search or tap "But… Why?", the text of that question is sent to our AI provider to
            write an answer (see "Who we share data with").
          </p>
        </Section>

        <Section title="What we collect when you have an account">
          <p>
            <b>Account details:</b> your email address and password (stored securely by our
            authentication provider, never in plain text). On the website you can instead sign in
            with Google or Apple, in which case we receive your name, email and profile picture from
            them.
          </p>
          <p>
            <b>Profile:</b> the display name, username, avatar, short bio and status message you
            choose, your age range and favourite topic if you set them, and your privacy choices
            (such as hiding from leaderboards).
          </p>
          <p>
            <b>Activity:</b> facts you've discovered, favourites, saved "But… Why?" chains, quiz
            answers and scores, daily missions, streaks, coins, achievements and store items.
          </p>
          <p>
            <b>Purchases:</b> Why? Plus is bought by a grown-up. On the website, Paddle handles the
            payment; in the apps, Google Play or the App Store does, with RevenueCat keeping track
            of the subscription for us. We store whether you have Plus, which plan, when it renews
            or ends, and reference numbers, never your card details.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            To run the app: saving your progress, awarding coins and achievements, showing
            leaderboards, preventing cheating and abuse, and fixing errors. We don't use your data
            for advertising.
          </p>
        </Section>

        <Section title="What other people can see">
          <p>
            Your display name or username, avatar and scores can appear on leaderboards and your
            public profile. You can turn this off in Settings with "Hide me from public
            leaderboards" and "Hide profile from public pages". A "But… Why?" chain is only public
            if you choose to share it.
          </p>
        </Section>

        <Section title="Who we share data with">
          <p>We use a small number of service providers who process data on our behalf:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Lovable Cloud and Supabase — hosting, database and sign-in.</li>
            <li>
              AI providers — Groq, OpenRouter, Pollinations and Lovable AI Gateway (Google Gemini) —
              write facts and "But… Why?" answers. Only the question text is sent, not your name or
              email.
            </li>
            <li>Paddle — payments on the website.</li>
            <li>
              Google Play, the App Store and RevenueCat — Why? Plus subscriptions bought in the
              apps. RevenueCat receives your account ID (not your name or email) to link a purchase
              to your account.
            </li>
            <li>Google and Apple — only if you choose to sign in with them on the website.</li>
          </ul>
          <p>We don't sell or rent personal data to anyone.</p>
        </Section>

        <Section title="Children">
          <p>
            Why? is made for curious minds of all ages. Accounts are for people aged 13 and over;
            younger explorers can use guest mode, which doesn't collect personal information. If
            you're a parent and think your child under 13 created an account, contact us and we'll
            delete it.
          </p>
        </Section>

        <Section title="How long we keep it">
          <p>
            We keep your account data until you delete your account. Deleting it removes your
            profile and activity straight away. Paddle keeps payment records as the law requires.
          </p>
        </Section>

        <Section title="Your choices and rights">
          <p>
            You can see and change your profile in Settings, hide yourself from leaderboards, and
            delete your account at any time on the{" "}
            <Link to="/delete-account" className="font-bold underline">
              delete account
            </Link>{" "}
            page (also in Settings). Depending on where you live, you may have further rights, such
            as getting a copy of your data. Contact us to use them.
          </p>
        </Section>

        <Section title="Data on your device">
          <p>
            We store small pieces of data on your device to keep you signed in and remember your
            settings and guest progress. These aren't used for tracking.
          </p>
        </Section>

        <Section title="Contact">
          <p>
            {CONTACT_EMAIL ? (
              <>
                Questions about privacy? Email us at{" "}
                <a href={`mailto:${CONTACT_EMAIL}`} className="font-bold underline">
                  {CONTACT_EMAIL}
                </a>
                .
              </>
            ) : (
              <>Questions about privacy? Use the contact email on our app store listing.</>
            )}
          </p>
          <p>If this policy changes, we'll update the date at the top.</p>
        </Section>
      </article>
    </main>
  );
}
