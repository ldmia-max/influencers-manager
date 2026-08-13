import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-keys";
import { getProfile } from "@/services/profile";
import type { ProfileDetail } from "@/services/profile";

export type { ProfileDetail };

// =============================================================================
// Profile Detail (client-side, for sheets/modals)
// =============================================================================

export function useProfile(profileId: string | null) {
  return useQuery<ProfileDetail>({
    queryKey: queryKeys.profiles.detail(profileId!),
    queryFn: () => getProfile(profileId!),
    enabled: !!profileId,
  });
}
