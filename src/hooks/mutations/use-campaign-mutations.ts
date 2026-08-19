import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import {
  createCampaign,
  updateCampaign,
  saveCampaignProfiles,
  updateCampaignStatus,
  regenerateApprovalToken,
} from "@/services/campaign";
import type {
  CampaignPayload,
  CampaignProfilePayload,
  CreateCampaignResponse,
  UpdateStatusResponse,
  RegenerateTokenResponse,
} from "@/services/campaign";
import type { CampaignStatus } from "@prisma/client";

// =============================================================================
// Create Campaign
// =============================================================================

export function useCreateCampaign() {
  const queryClient = useQueryClient();

  return useMutation<CreateCampaignResponse, Error, CampaignPayload>({
    mutationFn: (payload) => createCampaign(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

// =============================================================================
// Update Campaign
// =============================================================================

export function useUpdateCampaign() {
  const queryClient = useQueryClient();

  return useMutation<
    CreateCampaignResponse,
    Error,
    { campaignId: string; payload: CampaignPayload }
  >({
    mutationFn: ({ campaignId, payload }) =>
      updateCampaign(campaignId, payload),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(campaignId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
    },
  });
}

// =============================================================================
// Delete Campaign
// =============================================================================


// =============================================================================
// Save Campaign Profiles
// =============================================================================

export function useSaveCampaignProfiles() {
  const queryClient = useQueryClient();

  return useMutation<
    { success: boolean },
    Error,
    { campaignId: string; profiles: CampaignProfilePayload[] }
  >({
    mutationFn: ({ campaignId, profiles }) =>
      saveCampaignProfiles(campaignId, profiles),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(campaignId),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.profiles(campaignId),
      });
    },
  });
}

// =============================================================================
// Update Campaign Status
// =============================================================================

export function useUpdateCampaignStatus() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation<
    UpdateStatusResponse,
    Error,
    { campaignId: string; status: CampaignStatus; reason?: string }
  >({
    mutationFn: ({ campaignId, status, reason }) =>
      updateCampaignStatus(campaignId, status, reason),
    onSuccess: (_, { campaignId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(campaignId),
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.campaigns.all });
      router.refresh();
    },
  });
}

// =============================================================================
// Regenerate Approval Token
// =============================================================================

export function useRegenerateApprovalToken() {
  const queryClient = useQueryClient();

  return useMutation<RegenerateTokenResponse, Error, string>({
    mutationFn: (campaignId: string) => regenerateApprovalToken(campaignId),
    onSuccess: (_, campaignId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.campaigns.detail(campaignId),
      });
    },
  });
}
