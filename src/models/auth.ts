// =============================================================================
// Authentication result types (single source of truth)
// =============================================================================

export interface RegisterResult {
  success: boolean;
  message?: string;
}

export interface ClientLoginResult {
  success: boolean;
  redirectUrl?: string;
  message?: string;
}
