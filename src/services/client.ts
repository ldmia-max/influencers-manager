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
 * Manda al cliente el enlace para que elija su contrasena.
 *
 * Devuelve a quien se envio y como fue el correo, para que el boton
 * pueda decir que el enlace no salio en vez de dar por hecho que si.
 */
export async function enviarEnlaceDeAcceso(clientId: string): Promise<{
  destino: string;
  expiresAt: string;
  email: { sent: boolean; reason?: string; error?: string };
}> {
  return apiPost(`/api/clients/${clientId}/access/enlace`, {});
}

/**
 * Revoke client portal access
 */
export async function revokeClientAccess(clientId: string): Promise<{ success: boolean }> {
  return apiDelete(`/api/clients/${clientId}/access`);
}
