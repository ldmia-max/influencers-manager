import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { submitApproval } from "@/services/approval";
import type {
  SubmitApprovalPayload,
  SubmitApprovalResult,
} from "@/services/approval";

// =============================================================================
// Submit Approval Decisions
// =============================================================================

export function useSubmitApproval(token: string) {
  const queryClient = useQueryClient();

  return useMutation<SubmitApprovalResult, Error, SubmitApprovalPayload>({
    mutationFn: (payload) => submitApproval(token, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.approval.data(token),
      });
    },
  });
}
