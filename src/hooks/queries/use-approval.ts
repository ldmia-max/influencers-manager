import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getApprovalData } from "@/services/approval";
import type { ApprovalData } from "@/services/approval";

// =============================================================================
// Approval Data (public, token-based)
// =============================================================================

export function useApprovalData(token: string) {
  return useQuery<ApprovalData>({
    queryKey: queryKeys.approval.data(token),
    queryFn: () => getApprovalData(token),
    enabled: !!token,
    retry: false,
  });
}
