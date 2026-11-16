import { Link } from "@tanstack/react-router";
import { factSlug } from "@/lib/site";
import { asWhyQuestion } from "@/lib/whyQuestion";

export type MissedFact = { question: string; code: string | null };

/** End of a quiz: the facts the player got wrong, so they can read them. */
export function MissedFacts({ missed }: { missed: MissedFact[] }) {
  if (missed.length === 0) return null;
  return (
    <section className="mt-5 text-left" aria-labelledby="missed-heading">
      <h2 id="missed-heading" className="text-sm font-black text-white">
        Read the facts you missed
      </h2>
      <ul className="mt-2 space-y-1.5">
        {missed.map((m) => (
          <li key={m.question}>
            {m.code ? (
              <Link
                to="/fact/$slug"
                params={{ slug: factSlug(m.question, m.code) }}
                className="flex items-center justify-between gap-2 rounded-2xl bg-white/[0.06] px-3 py-2 text-sm font-bold text-white hover:bg-white/10"
              >
                {asWhyQuestion(m.question)}
                <span aria-hidden className="text-white/50">
                  →
                </span>
              </Link>
            ) : (
              <p className="rounded-2xl bg-white/[0.06] px-3 py-2 text-sm font-bold text-white/80">
                {asWhyQuestion(m.question)}
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
