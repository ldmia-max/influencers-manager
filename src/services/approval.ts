/**
 * Public campaign approval API services
 */

import { apiGet, apiPost } from "./api";
import type { SubmitApprovalPayload } from "@/lib/schemas/approval";

// Re-export types from schemas
export type { SubmitApprovalPayload };

// Backwards-compatible alias
export type FinalDecisions = SubmitApprovalPayload;

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type {
  ApprovalProfileService,
  ApprovalProfilePlatform,
  ApprovalProfile,
  ApprovalCampaign,
  ApprovalData,
  SubmitApprovalResult,
} from "@/models/approval";
import type { ApprovalData, SubmitApprovalResult } from "@/models/approval";

// =============================================================================
// Approval Operations
// =============================================================================

/**
 * Get campaign data for approval by token
 */
export async function getApprovalData(token: string): Promise<ApprovalData> {
  return apiGet<ApprovalData>(`/api/public/approve/${token}`);
}

/**
 * Submit approval decisions
 */
export async function submitApproval(
  token: string,
  payload: SubmitApprovalPayload
): Promise<SubmitApprovalResult> {
  return apiPost<SubmitApprovalResult>(`/api/public/approve/${token}/submit`, {
    finalDecisions: payload,
  });
}
