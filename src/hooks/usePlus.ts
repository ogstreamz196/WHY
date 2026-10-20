import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getMyPlus, refreshMyPlus, type PlusStatus } from "@/lib/plus.functions";
import { canUseNativePurchases, watchNativeCustomerInfo } from "@/lib/nativePurchases";
import { isNativeApp, useIsNativeApp } from "@/lib/platform";

/**
 * Whether Why? Plus can be bought here: always on the website (Paddle), and in
 * the apps only when the build can really use store billing. null while
 * unknown, so Plus UI never flashes before the answer.
 */
export function usePlusForSale(): boolean | null {
  const isNative = useIsNativeApp();
  const [nativeOk, setNativeOk] = useState<boolean | null>(null);
  useEffect(() => {
    if (isNative !== true) return;
    let cancelled = false;
    void canUseNativePurchases().then((ok) => {
      if (!cancelled) setNativeOk(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [isNative]);
  if (isNative === null) return null;
  return isNative ? nativeOk : true;
}

// One store customer-info listener for the whole app, however many components
// call usePlus (each would otherwise re-sync on every store push).
type StoreWatch = { userId: string; refs: number; stop: Promise<(() => void) | null> };
let storeWatch: StoreWatch | null = null;

function retainStoreWatch(
  userId: string,
  qc: QueryClient,
  refresh: () => Promise<PlusStatus>,
): () => void {
  if (storeWatch && storeWatch.userId !== userId) {
    void storeWatch.stop.then((s) => s?.());
    storeWatch = null;
  }
  if (!storeWatch) {
    storeWatch = {
      userId,
      refs: 0,
      stop: watchNativeCustomerInfo(userId, (storeHasPlus) => {
        const known = qc.getQueryData<PlusStatus>(["plus", userId]);
        // Website (Paddle) Plus isn't the store's business.
        if (!known || known.source === "web" || storeHasPlus === known.active) return;
        void refresh().then(() => qc.invalidateQueries({ queryKey: ["plus", userId] }));
      }).catch((e) => {
        console.warn("[plus] couldn't watch store customer info", e);
        return null;
      }),
    };
  }
  const w = storeWatch;
  w.refs++;
  return () => {
    if (storeWatch !== w || --w.refs > 0) return;
    storeWatch = null;
    void w.stop.then((s) => s?.());
  };
}

/** Why? Plus status for the signed-in user (website or app-store subscription). */
export function usePlus(userId: string | null | undefined) {
  const qc = useQueryClient();
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
    if (!userId || !q.isSuccess || !isNativeApp()) return;
    let release: (() => void) | null = null;
    let cancelled = false;
    void canUseNativePurchases().then((ok) => {
      if (ok && !cancelled) release = retainStoreWatch(userId, qc, refresh);
    });
    return () => {
      cancelled = true;
      release?.();
    };
  }, [userId, q.isSuccess, qc, refresh]);

  return { plus, isPlus, loading: q.isLoading, refetch };
}
