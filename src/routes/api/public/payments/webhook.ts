import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { verifyWebhook, EventName, type PaddleEnv } from "@/lib/paddle.server";

const SIGNUP_BONUS_COINS = 500;

let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  }
  return _supabase;
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

  const { data: existing } = await supabase
    .from("subscriptions")
    .select("id, signup_bonus_awarded")
    .eq("paddle_subscription_id", id)
    .maybeSingle();

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
  );

  // Award one-time signup bonus (500 coins) on first subscription per user
  const alreadyAwarded = (existing as { signup_bonus_awarded?: boolean } | null)?.signup_bonus_awarded;
  if (!alreadyAwarded && (status === "active" || status === "trialing")) {
    const { data: anyPrior } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("user_id", userId)
      .eq("signup_bonus_awarded", true)
      .limit(1);
    if (!anyPrior || anyPrior.length === 0) {
      // Bump user stats
      const { data: stats } = await supabase
        .from("user_stats")
        .select("total_points")
        .eq("user_id", userId)
        .maybeSingle();
      const current = (stats as { total_points?: number } | null)?.total_points ?? 0;
      await supabase
        .from("user_stats")
        .update({ total_points: current + SIGNUP_BONUS_COINS })
        .eq("user_id", userId);
      await supabase
        .from("subscriptions")
        .update({ signup_bonus_awarded: true })
        .eq("paddle_subscription_id", id);
    }
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionUpdated(data: any, env: PaddleEnv) {
  const { id, status, currentBillingPeriod, scheduledChange } = data;
  // Business rule: revoke VIP immediately on past_due (failed payment)
  const effectiveStatus = status === "past_due" ? "canceled" : status;
  await getSupabase()
    .from("subscriptions")
    .update({
      status: effectiveStatus,
      current_period_start: currentBillingPeriod?.startsAt,
      current_period_end: currentBillingPeriod?.endsAt,
      cancel_at_period_end: scheduledChange?.action === "cancel",
      updated_at: new Date().toISOString(),
    })
    .eq("paddle_subscription_id", id)
    .eq("environment", env);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSubscriptionCanceled(data: any, env: PaddleEnv) {
  // Business rule: revoke VIP immediately (no grace period)
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", data.id)
    .eq("environment", env);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleTransactionPaymentFailed(data: any, env: PaddleEnv) {
  const subscriptionId = data.subscriptionId;
  if (!subscriptionId) return;
  await getSupabase()
    .from("subscriptions")
    .update({ status: "canceled", updated_at: new Date().toISOString() })
    .eq("paddle_subscription_id", subscriptionId)
    .eq("environment", env);
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
