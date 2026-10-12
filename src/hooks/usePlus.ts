import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getMyPlus, type PlusStatus } from "@/lib/plus.functions";

/** Why? Plus status for the signed-in user (website or app-store subscription). */
export function usePlus(userId: string | null | undefined) {
  const fetchPlus = useServerFn(getMyPlus);
  const q = useQuery({
    queryKey: ["plus", userId],
    queryFn: () => fetchPlus(),
    enabled: !!userId,
    staleTime: 60_000,
  });
  const plus: PlusStatus | null = userId ? (q.data ?? null) : null;
  return { plus, isPlus: !!plus?.active, loading: q.isLoading, refetch: q.refetch };
}
