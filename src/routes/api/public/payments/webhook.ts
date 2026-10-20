import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, getPaddleClient, EventName, type PaddleEnv } from "@/lib/paddle.server";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: any = null;
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
}

/** Supabase returns errors instead of throwing; throw so Paddle gets a non-2xx and retries. */
function check<T extends { error: { message: string } | null }>(res: T, what: string): T {
  if (res.error) throw new Error(`${what}: ${res.error.message}`);
  return res;
}

/**
 * Re-read a subscription from Paddle and store its current state. Webhooks can
 * repeat or arrive out of order (a late "updated" retry after "canceled", or
 * "updated" before "created"), so we never trust the event's own snapshot.
 */
async function syncSubscription(subscriptionId: string, env: PaddleEnv) {
  const sub = await getPaddleClient(env).subscriptions.get(subscriptionId);
  // Business rule: revoke Plus immediately on past_due (failed payment), no grace period.
  const status = sub.status === "past_due" ? "canceled" : sub.status;
  const state = {
    status,
    current_period_start: sub.currentBillingPeriod?.startsAt ?? null,
    current_period_end: sub.currentBillingPeriod?.endsAt ?? null,
    cancel_at_period_end: sub.scheduledChange?.action === "cancel",
    updated_at: new Date().toISOString(),
  };
  const supabase = getSupabase();

  const userId = typeof sub.customData?.userId === "string" ? sub.customData.userId : null;
  const item = sub.items[0];
  const priceId = item?.price.importMeta?.externalId;
  const productId = item?.product.importMeta?.externalId;
  if (userId && priceId && productId) {
    check(
      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          paddle_subscription_id: sub.id,
          paddle_customer_id: sub.customerId,
          product_id: productId,
          price_id: priceId,
          environment: env,
          ...state,
        },
        { onConflict: "paddle_subscription_id" },
      ),
      "upsert subscription",
    );
    return;
  }

  // Not enough to create a row: keep the existing row's owner and update its state.
  const res = check(
    await supabase
      .from("subscriptions")
      .update(state)
      .eq("paddle_subscription_id", sub.id)
      .eq("environment", env)
      .select("id"),
    "update subscription",
  );
  if (!res.data?.length) {
    console.warn("Skipping subscription: no stored row and no userId/importMeta.externalId", {
      subscriptionId: sub.id,
      hasUserId: !!userId,
      rawPriceId: item?.price.id,
      rawProductId: item?.product.id,
    });
  }
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
    case EventName.SubscriptionUpdated:
    case EventName.SubscriptionCanceled:
      await syncSubscription(event.data.id, env);
      break;
    case EventName.TransactionPaymentFailed:
      // A failed payment doesn't always end the subscription (e.g. a failed
      // card update); store whatever Paddle now says it is.
      if (event.data.subscriptionId) await syncSubscription(event.data.subscriptionId, env);
      break;
    default:
      console.log("Unhandled event:", event.eventType);
  }
}

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const url = new URL(request.url);
        const env = (url.searchParams.get("env") || "sandbox") as PaddleEnv;
        try {
          await handleWebhook(request, env);
          return Response.json({ received: true });
        } catch (e) {
          console.error("Webhook error:", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
