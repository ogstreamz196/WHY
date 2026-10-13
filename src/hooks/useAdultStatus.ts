import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdultStatus } from "@/lib/adult.functions";
import { useIsNativeApp } from "@/lib/platform";

/**
 * 18+ status for the signed-in player. Never asks inside the Android/iOS
 * apps, and `show` is only true on the website for players whose saved
 * birthday makes them 18 or over.
 */
export function useAdultStatus(userId: string | null | undefined) {
  const isNative = useIsNativeApp();
  const fetchStatus = useServerFn(getAdultStatus);
  const q = useQuery({
    queryKey: ["adult-status", userId],
    queryFn: () => fetchStatus(),
    enabled: !!userId && isNative === false,
    staleTime: 60_000,
  });
  return {
    status: q.data ?? null,
    show: isNative === false && !!userId && !!q.data?.available,
    refetch: q.refetch,
  };
}
