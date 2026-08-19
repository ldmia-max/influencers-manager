/**
 * Client API services
 */

import { apiPost, apiPut, apiDelete } from "./api";
import type {
  ClientContactPayload,
  CreateClientPayload,
  UpdateClientPayload,
  ClientAccessPayload,
} from "@/lib/schemas/client";

// Re-export types from schemas
export type { ClientContactPayload, CreateClientPayload, UpdateClientPayload, ClientAccessPayload };

// Backwards-compatible aliases
export type ClientContact = ClientContactPayload;
export type ClientPayload = CreateClientPayload;

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type { ClientResponse, ClientAccessResult } from "@/models/client";
import type { ClientResponse, ClientAccessResult } from "@/models/client";

// =============================================================================
// Client Operations
// =============================================================================

/**
 * Create a client
 */
export async function createClient(payload: CreateClientPayload): Promise<ClientResponse> {
  return apiPost<ClientResponse>("/api/clients", payload);
}

/**
 * Update a client
 */
export async function updateClient(clientId: string, payload: UpdateClientPayload): Promise<ClientResponse> {
  return apiPut<ClientResponse>(`/api/clients/${clientId}`, payload);
}


/**
 * Create client portal access (set password)
 */
export async function createClientAccess(
  clientId: string,
  payload: ClientAccessPayload
): Promise<ClientAccessResult> {
  return apiPost<ClientAccessResult>(`/api/clients/${clientId}/access`, payload);
}

/**
 * Revoke client portal access
 */
export async function revokeClientAccess(clientId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/clients/${clientId}/access`);
}
