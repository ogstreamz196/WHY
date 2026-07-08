import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export type Subscription = {
  id: string;
  user_id: string;
  paddle_subscription_id: string;
  paddle_customer_id: string;
  product_id: string;
  price_id: string;
  status: string;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  environment: string;
};

export function useSubscription(userId: string | null | undefined) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const env = getPaddleEnvironment();

  const fetchSub = async () => {
    if (!userId) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    // Types haven't regenerated for the new table yet; cast for now.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = await (supabase as any)
      .from("subscriptions")
      .select("*")
      .eq("user_id", userId)
      .eq("environment", env)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setSubscription((data as Subscription | null) ?? null);
    setLoading(false);
  };

  useEffect(() => {
    setLoading(true);
    fetchSub();
    if (!userId) return;
    const channel = supabase
      .channel(`subscriptions:${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
        () => fetchSub(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, env]);

  const isVip = !!subscription && (subscription.status === "active" || subscription.status === "trialing");

  return { subscription, isVip, loading, refetch: fetchSub };
}
