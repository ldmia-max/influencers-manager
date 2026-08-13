/**
 * Authentication API services
 */

import { apiPost } from "./api";
import type { RegisterPayload, ClientLoginPayload } from "@/lib/schemas/auth";

// Re-export types from schemas
export type { RegisterPayload, ClientLoginPayload };

// =============================================================================
// Types (re-exported from models/)
// =============================================================================

export type { RegisterResult, ClientLoginResult } from "@/models/auth";
import type { RegisterResult, ClientLoginResult } from "@/models/auth";

// =============================================================================
// Auth Operations
// =============================================================================

/**
 * Register a new user
 */
export async function register(payload: RegisterPayload): Promise<RegisterResult> {
  return apiPost<RegisterResult>("/api/auth/register", payload);
}

/**
 * Client portal login
 */
export async function clientLogin(payload: ClientLoginPayload): Promise<ClientLoginResult> {
  return apiPost<ClientLoginResult>("/api/client-auth/login", payload);
}
