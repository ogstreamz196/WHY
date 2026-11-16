import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { CosmicBackground } from "@/components/CosmicBackground";
import mascotImg from "@/assets/mascot.png";

/**
 * The one "can't find it" screen: missing pages, facts and trails all look the
 * same and lead back to the questions.
 */
export function NotFoundCard({
  title = "Page not found",
  message = "This corner of the universe doesn't exist yet.",
}: {
  title?: string;
  message?: string;
}) {
  // Not-found screens keep whatever title the last page set; say what this is.
  useEffect(() => {
    document.title = `${title} | Why?`;
  }, [title]);
  return (
    <main className="relative flex min-h-[100dvh] items-center justify-center px-4 text-center">
      <CosmicBackground />
      <div className="glass-strong max-w-md rounded-4xl p-8">
        <img
          src={mascotImg}
          alt=""
          className="mx-auto h-24 w-24 object-contain animate-float-slow"
          decoding="async"
        />
        <h1 className="mt-3 font-display text-2xl font-black text-white">{title}</h1>
        <p className="mt-2 text-sm text-white/70">{message}</p>
        <Link
          to="/"
          className="mt-6 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold text-white shadow-[var(--shadow-glow)]"
          style={{ background: "var(--gradient-primary)" }}
        >
          Back to the questions
        </Link>
      </div>
    </main>
  );
}
