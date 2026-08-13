import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { apiGet } from "@/services/api";
import type { CampaignDetail } from "@/models/campaign";

export type { CampaignDetail };

// =============================================================================
// Campaign Detail (client-side)
// =============================================================================

export function useCampaign(campaignId: string | null) {
  return useQuery<CampaignDetail>({
    queryKey: queryKeys.campaigns.detail(campaignId!),
    queryFn: () => apiGet<CampaignDetail>(`/api/campaigns/${campaignId}`),
    enabled: !!campaignId,
  });
}
