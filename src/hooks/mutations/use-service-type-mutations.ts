import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import { editServiceType } from "@/services/admin";
import type { ServiceType, EditServiceTypePayload } from "@/services/admin";

export function useEditServiceType(serviceTypeId: string) {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<ServiceType, Error, EditServiceTypePayload>({
    mutationFn: (payload) => editServiceType(serviceTypeId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.admin.serviceTypes() });
      queryClient.invalidateQueries({ queryKey: queryKeys.serviceTypes.all });
      router.refresh();
    },
  });
}
