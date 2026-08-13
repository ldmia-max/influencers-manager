import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { queryKeys } from "@/lib/query-keys";
import { createProfile, updateProfile, deleteProfile, syncProfile } from "@/services/profile";
import type { ProfilePayload, ProfileResponse, SyncResult } from "@/services/profile";

// =============================================================================
// Create Profile
// =============================================================================

export function useCreateProfile() {
  const queryClient = useQueryClient();

  return useMutation<ProfileResponse, Error, ProfilePayload>({
    mutationFn: (payload) => createProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

// =============================================================================
// Update Profile
// =============================================================================

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation<
    ProfileResponse,
    Error,
    { profileId: string; payload: ProfilePayload }
  >({
    mutationFn: ({ profileId, payload }) => updateProfile(profileId, payload),
    onSuccess: (_, { profileId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.detail(profileId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
    },
  });
}

// =============================================================================
// Delete Profile
// =============================================================================

export function useDeleteProfile() {
  const queryClient = useQueryClient();
  const router = useRouter();

  return useMutation({
    mutationFn: (profileId: string) => deleteProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.all });
      router.refresh();
    },
  });
}

// =============================================================================
// Sync Profile (Apify scraping)
// =============================================================================

export function useSyncProfile() {
  const queryClient = useQueryClient();

  return useMutation<SyncResult, Error, string>({
    mutationFn: (profileId: string) => syncProfile(profileId),
    onSuccess: (_, profileId) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.profiles.detail(profileId),
      });
    },
  });
}
