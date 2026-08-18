/**
 * Authentication API services
 */

import { apiPost } from "./api";
import type { ClientLoginPayload } from "@/lib/schemas/auth";

// Re-export types from schemas
export type { ClientLoginPayload };

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type { ClientLoginResult } from "@/models/auth";
import type { ClientLoginResult } from "@/models/auth";

// =============================================================================
// Auth Operations
// =============================================================================

/**
 * Client portal login
 */
export async function clientLogin(payload: ClientLoginPayload): Promise<ClientLoginResult> {
  return apiPost<ClientLoginResult>("/api/client-auth/login", payload);
}
