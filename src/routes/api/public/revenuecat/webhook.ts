import { createFileRoute } from "@tanstack/react-router";

// RevenueCat webhook (Google Play / App Store purchases of Why? Plus).
// RevenueCat sends the Authorization header configured in its dashboard;
// it must match REVENUECAT_WEBHOOK_AUTH. On every event we re-read the
// subscriber from RevenueCat's API (syncRevenueCat), so duplicate or
// out-of-order events can't leave a wrong state.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type RcEvent = {
  type?: string;
  app_user_id?: string;
  original_app_user_id?: string;
  aliases?: string[];
  transferred_from?: string[];
  transferred_to?: string[];
};

export const Route = createFileRoute("/api/public/revenuecat/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
        if (!expected) {
          return Response.json({ ok: false, error: "webhook_not_configured" }, { status: 503 });
        }
        const provided = request.headers.get("authorization") ?? "";
        const { timingSafeEqual } = await import("crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return new Response("Unauthorized", { status: 401 });
        }

        let event: RcEvent;
        try {
          event = ((await request.json()) as { event?: RcEvent }).event ?? {};
        } catch {
          return new Response("Bad request", { status: 400 });
        }

        // App user IDs are Supabase user IDs; anonymous RevenueCat IDs
        // ($RCAnonymousID:…) and anything else are ignored.
        const ids = new Set(
          [
            event.app_user_id,
            event.original_app_user_id,
            ...(event.aliases ?? []),
            ...(event.transferred_from ?? []),
            ...(event.transferred_to ?? []),
          ].filter((id): id is string => !!id && UUID.test(id)),
        );

        const { syncRevenueCat } = await import("@/lib/plus.server");
        try {
          for (const id of ids) await syncRevenueCat(id);
        } catch (e) {
          console.error("[revenuecat] sync failed:", e);
          // Non-2xx makes RevenueCat retry later.
          return new Response("Sync failed", { status: 500 });
        }
        return Response.json({ ok: true, synced: ids.size });
      },
    },
  },
});
