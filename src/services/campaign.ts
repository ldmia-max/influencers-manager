/**
 * Campaign API services
 */

import type { CampaignStatus } from "@prisma/client";
import { apiPost, apiPut, apiPatch } from "./api";
import type {
  CreateCampaignPayload,
  UpdateCampaignPayload,
  SetCampaignProfilesPayload,
} from "@/lib/schemas/campaign";

// Re-export types from schemas
export type { CreateCampaignPayload, UpdateCampaignPayload, SetCampaignProfilesPayload };

// Re-export ApiError for backwards compatibility
export { ApiError } from "./api";

// Backwards-compatible aliases
export type CampaignPayload = CreateCampaignPayload;
export type CampaignProfilePayload = SetCampaignProfilesPayload["profiles"][number];

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type {
  CreateCampaignResponse,
  UpdateStatusResponse,
  RegenerateTokenResponse,
  CampaignFormData,
} from "@/models/campaign";
import type {
  CreateCampaignResponse,
  UpdateStatusResponse,
  RegenerateTokenResponse,
  CampaignFormData,
} from "@/models/campaign";

// =============================================================================
// Campaign CRUD
// =============================================================================

/**
 * Create a new campaign
 */
export async function createCampaign(
  payload: CreateCampaignPayload
): Promise<CreateCampaignResponse> {
  return apiPost<CreateCampaignResponse>("/api/campaigns", payload);
}

/**
 * Update an existing campaign
 */
export async function updateCampaign(
  campaignId: string,
  payload: UpdateCampaignPayload
): Promise<CreateCampaignResponse> {
  return apiPut<CreateCampaignResponse>(`/api/campaigns/${campaignId}`, payload);
}


// =============================================================================
// Campaign Profiles
// =============================================================================

/**
 * Save campaign profiles with their platforms and services
 */
export async function saveCampaignProfiles(
  campaignId: string,
  profiles: SetCampaignProfilesPayload["profiles"]
): Promise<{ success: boolean }> {
  return apiPost<{ success: boolean }>(`/api/campaigns/${campaignId}/profiles`, { profiles });
}

// =============================================================================
// Campaign Status
// =============================================================================

/**
 * Update campaign status
 */
export async function updateCampaignStatus(
  campaignId: string,
  status: CampaignStatus,
  reason?: string
): Promise<UpdateStatusResponse> {
  return apiPatch<UpdateStatusResponse>(`/api/campaigns/${campaignId}/status`, { status, reason });
}

// =============================================================================
// Approval Tokens
// =============================================================================

/**
 * Regenerate approval token for a campaign
 */
export async function regenerateApprovalToken(
  campaignId: string
): Promise<RegenerateTokenResponse> {
  return apiPost<RegenerateTokenResponse>(`/api/campaigns/${campaignId}/regenerate-token`);
}

/**
 * Vuelve a mandar los enlaces que ya existen, sin emitir ninguno.
 *
 * La salida para cuando el correo no sale. Va a otra ruta que
 * regenerateApprovalToken a proposito: aquella emite enlaces nuevos, y
 * usarla como "reenviar" mataria el que el cliente quiza ya tiene.
 */
export async function reenviarRevision(
  campaignId: string
): Promise<{
  message: string;
  email?: { sent: boolean; reason?: string; error?: string };
  destinatarios: { email: string; sent: boolean; error?: string }[];
}> {
  return apiPost(`/api/campaigns/${campaignId}/reenviar-revision`);
}

// =============================================================================
// Helper: Build campaign payload from form data
// =============================================================================

export function buildCampaignPayload(formData: CampaignFormData): CreateCampaignPayload {
  return {
    name: formData.name,
    description: formData.description || undefined,
    clientId: formData.clientId,
    clientContactId: formData.clientContactId,
    clientContactIds: formData.clientContactIds,
    budget: parseInt(formData.budget, 10),
    startDate: formData.startDate || undefined,
    endDate: formData.endDate || undefined,
    // Periodo de imputacion. No cae a undefined como las fechas: es
    // obligatorio, y el formulario siempre lo trae con valor.
    mes: parseInt(formData.mes, 10),
    anio: parseInt(formData.anio, 10),
  };
}
