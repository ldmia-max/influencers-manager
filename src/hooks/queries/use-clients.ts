import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";
import type { ClientDetail } from "@/models/client";

export type { ClientDetail };

// =============================================================================
// Client Detail (client-side)
// =============================================================================

export function useClient(clientId: string | null) {
  return useQuery<ClientDetail>({
    queryKey: queryKeys.clients.detail(clientId!),
    queryFn: () => apiGet<ClientDetail>(`/api/clients/${clientId}`),
    enabled: !!clientId,
  });
}
