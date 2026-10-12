import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { getMyPlus, refreshMyPlus, type PlusStatus } from "@/lib/plus.functions";
import { isNativePurchasesAvailable, watchNativeCustomerInfo } from "@/lib/nativePurchases";
import { isNativeApp } from "@/lib/platform";

/** Why? Plus status for the signed-in user (website or app-store subscription). */
export function usePlus(userId: string | null | undefined) {
  const fetchPlus = useServerFn(getMyPlus);
  const refresh = useServerFn(refreshMyPlus);
  const q = useQuery({
    queryKey: ["plus", userId],
    queryFn: () => fetchPlus(),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const plus: PlusStatus | null = userId ? (q.data ?? null) : null;
  const isPlus = !!plus?.active;
  const { refetch } = q;

  // In the apps, the store pushes customer info changes (renewal, expiry,
  // refund, a purchase on another device). When it disagrees with what the
  // server knows, ask the server to re-sync from RevenueCat.
  useEffect(() => {
    if (!userId || !q.isSuccess || !isNativeApp() || !isNativePurchasesAvailable()) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    watchNativeCustomerInfo(userId, (storeHasPlus) => {
      if (storeHasPlus === isPlus) return;
      void refresh().then(() => refetch());
    })
      .then((s) => {
        if (cancelled) s();
        else stop = s;
      })
      .catch((e) => console.warn("[plus] couldn't watch store customer info", e));
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId, q.isSuccess, isPlus, refresh, refetch]);

  return { plus, isPlus, loading: q.isLoading, refetch };
}
