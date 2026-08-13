/**
 * Profile API services
 */

import { apiGet, apiPost, apiPut, apiDelete } from "./api";
import type { ProfilePayload } from "@/lib/schemas/profile";

// Re-export types from schemas
export type { ProfilePayload };

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type {
  ProfileSocialAccount,
  ProfileDetail,
  ProfileResponse,
  SyncResult,
} from "@/models/profile";
import type { ProfileSocialAccount, ProfileDetail, ProfileResponse, SyncResult } from "@/models/profile";

// =============================================================================
// Profile Operations
// =============================================================================

/**
 * Get profile details by ID
 */
export async function getProfile(profileId: string): Promise<ProfileDetail> {
  return apiGet<ProfileDetail>(`/api/profiles/${profileId}`);
}

/**
 * Create a new profile
 */
export async function createProfile(payload: ProfilePayload): Promise<ProfileResponse> {
  return apiPost<ProfileResponse>("/api/profiles", payload);
}

/**
 * Update an existing profile
 */
export async function updateProfile(profileId: string, payload: ProfilePayload): Promise<ProfileResponse> {
  return apiPut<ProfileResponse>(`/api/profiles/${profileId}`, payload);
}

/**
 * Delete a profile
 */
export async function deleteProfile(profileId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/profiles/${profileId}`);
}

/**
 * Sync profile social accounts with external APIs (Apify)
 */
export async function syncProfile(profileId: string): Promise<SyncResult> {
  return apiPost<SyncResult>(`/api/profiles/${profileId}/sync`);
}
