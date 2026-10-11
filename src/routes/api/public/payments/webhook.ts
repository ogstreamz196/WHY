import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";
import { computeCoinDrop } from "@/lib/coinDrop";

const SIGNUP_BONUS_COINS_BASE = 500;

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCreated(data: any, env: PaddleEnv) {
  const { id, customerId, items, status, currentBillingPeriod, customData } = data;
  const userId = customData?.userId;
  if (!userId) {
    console.error("No userId in customData");
    return;
  }
  const item = items[0];
  const priceId = item.price.importMeta?.externalId;
  const productId = item.product.importMeta?.externalId;
  if (!priceId || !productId) {
    console.warn("Skipping subscription: missing importMeta.externalId", {
      rawPriceId: item.price.id,
      rawProductId: item.product.id,
    });
    return;
  }

  const supabase = getSupabase();

  check(
    await supabase.from("subscriptions").upsert(
      {
        user_id: userId,
        paddle_subscription_id: id,
        paddle_customer_id: customerId,
        product_id: productId,
        price_id: priceId,
        status,
        current_period_start: currentBillingPeriod?.startsAt,
        current_period_end: currentBillingPeriod?.endsAt,
        environment: env,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "paddle_subscription_id" },
    ),
    "upsert subscription",
  );

  // Award a one-time signup bonus on the user's first subscription.
  if (status !== "active" && status !== "trialing") return;
  const { data: anyPrior } = check(
    await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("signup_bonus_awarded", true)
      .limit(1),
    "check prior bonus",
  );
  if (anyPrior && anyPrior.length > 0) return;

  // Flip the flag first; only the delivery that flips it pays the bonus, so
  // Paddle retries or duplicate events can't award it twice.
  const { data: claimed } = check(
    await supabase
      .from("subscriptions")
      .update({ signup_bonus_awarded: true })
      .eq("paddle_subscription_id", id)
      .eq("signup_bonus_awarded", false)
      .select("id"),
    "claim signup bonus",
  );
  if (!claimed || claimed.length === 0) return;

  // User just purchased VIP → award bonus at VIP rate (isVip: true).
  const bonus = computeCoinDrop(SIGNUP_BONUS_COINS_BASE, { isVip: true });
  check(
    await supabase.rpc("apply_points", { _user: userId, _points: bonus, _facts_seen: 0 }),
    "award signup bonus",
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;
  // Business rule: revoke VIP immediately on past_due (failed payment)
  const effectiveStatus = status === "past_due" ? "canceled" : status;
  check(await getSupabase()
    .from("subscriptions")
    .update({
      status: effectiveStatus,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env), "update subscription");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Business rule: revoke VIP immediately (no grace period)
  check(await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env), "cancel subscription");
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTransactionPaymentFailed(data: any, env: PaddleEnv) {
  const subscriptionId = data.subscriptionId;
  if (!subscriptionId) return;
  check(await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env), "cancel after failed payment");
}

async function handleWebhook(req: Request, env: PaddleEnv) {
  const event = await verifyWebhook(req, env);
  switch (event.eventType) {
    case EventName.SubscriptionCreated:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionCreated(event.data as any, env);
      break;
    case EventName.SubscriptionUpdated:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionUpdated(event.data as any, env);
      break;
    case EventName.SubscriptionCanceled:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleSubscriptionCanceled(event.data as any, env);
      break;
    case EventName.TransactionPaymentFailed:
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await handleTransactionPaymentFailed(event.data as any, env);
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
