import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";
import type { ReachRangeData } from "@/lib/format";

// =============================================================================
// Reach Ranges (reference data, rarely changes)
// =============================================================================

export function useReachRanges(initialData?: ReachRangeData[]) {
  return useQuery<ReachRangeData[]>({
    queryKey: queryKeys.reachRanges.all,
    queryFn: () => apiGet<ReachRangeData[]>("/api/locations/reach-ranges"),
    initialData,
    staleTime: Infinity,
  });
}
